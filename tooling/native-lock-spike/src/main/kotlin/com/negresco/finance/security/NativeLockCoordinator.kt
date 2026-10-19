package com.negresco.finance.security

/**
 * Experimental JVM-only policy core. Not linked to the Expo app and does not
 * store secrets, call Android Keystore or implement Android BiometricPrompt.
 * The production adapter MUST own the authenticator and the atomic store.
 */
internal const val LOCK_RECORD_VERSION = 1

internal data class LockRecord(val version: Int, val enabled: Boolean, val revision: Long, val disablePending: Boolean = false)
internal enum class LockAction { ENABLE, DISABLE, UNLOCK }
internal enum class LockResult { SUCCESS, PREPARED, DENIED, STALE, STORAGE_ERROR, MIGRATION_REQUIRED }
internal data class LockSnapshot(
  val enabled: Boolean,
  val unlocked: Boolean,
  val revision: Long,
  val migrationRequired: Boolean,
  val storageError: Boolean
)

/** Null is uninitialized, NOT permission to bypass the lock. */
internal interface AtomicLockStore {
  fun read(): LockRecord?
  /** Must commit the update atomically and durably or throw. */
  fun update(transform: (LockRecord?) -> LockRecord): LockRecord
}

/** Must be implemented by a native-only strong biometric prompt. */
internal fun interface NativeBiometricVerifier {
  fun authenticate(action: LockAction): Boolean
}

internal class NativeLockCoordinator(
  private val store: AtomicLockStore,
  private val verifier: NativeBiometricVerifier
) {
  private val mutex = Any()
  private var generation = 0L
  private var foreground = true
  private var unlocked = false
  private var promptInFlight = false

  fun onBackground() = synchronized(mutex) {
    generation++
    foreground = false
    unlocked = false
  }

  fun onForeground() = synchronized(mutex) {
    foreground = true
    // Returning from background never restores a previously unlocked session.
  }

  fun lockNow() = synchronized(mutex) {
    generation++
    unlocked = false
  }

  private fun validRecord(record: LockRecord?): LockRecord? {
    if (record == null) return null
    require(record.version == LOCK_RECORD_VERSION && record.revision >= 0L) {
      "Invalid native lock record"
    }
    return record
  }

  fun snapshot(): LockSnapshot = synchronized(mutex) {
    try {
      val record = validRecord(store.read())
        ?: return@synchronized LockSnapshot(true, false, -1L, true, false)
      LockSnapshot(record.enabled, foreground && unlocked && record.enabled,
        record.revision, false, false)
    } catch (_: Exception) {
      LockSnapshot(true, false, -1L, false, true)
    }
  }

  private data class Attempt(val generation: Long, val revision: Long)

  private fun beginAttempt(): Pair<Attempt?, LockResult?> = synchronized(mutex) {
    if (!foreground || promptInFlight) return@synchronized null to LockResult.DENIED
    try {
      val record = validRecord(store.read())
        ?: return@synchronized null to LockResult.MIGRATION_REQUIRED
      promptInFlight = true
      Attempt(generation, record.revision) to null
    } catch (_: Exception) {
      null to LockResult.STORAGE_ERROR
    }
  }

  /** Called only by the native adapter after a real native prompt. */
  fun request(action: LockAction): LockResult {
    val (attempt, failure) = beginAttempt()
    if (failure != null) return failure
    val ticket = attempt ?: return LockResult.DENIED
    try {
      val accepted = try { verifier.authenticate(action) } catch (_: Exception) { false }
      if (!accepted) return LockResult.DENIED

      return synchronized(mutex) {
      if (!foreground || ticket.generation != generation) return@synchronized LockResult.STALE
      try {
        if (action == LockAction.UNLOCK) {
          val current = validRecord(store.read())
            ?: return@synchronized LockResult.MIGRATION_REQUIRED
          if (current.revision != ticket.revision || !current.enabled)
            return@synchronized LockResult.STALE
          unlocked = true
          return@synchronized LockResult.SUCCESS
        }
        val enabled = action == LockAction.ENABLE
        val saved = store.update { previous ->
          val current = validRecord(previous)
            ?: throw IllegalStateException("Migration required")
          if (current.revision != ticket.revision || current.revision == Long.MAX_VALUE)
            throw IllegalStateException("Stale or exhausted revision")
          current.copy(enabled = enabled, revision = current.revision + 1L)
        }
        // The store is authoritative. Never trust a success return alone.
        if (saved.version != LOCK_RECORD_VERSION || saved.revision != ticket.revision + 1L ||
            saved.enabled != enabled) {
          unlocked = false
          return@synchronized LockResult.STORAGE_ERROR
        }
        unlocked = enabled
        generation++
        LockResult.SUCCESS
      } catch (_: Exception) {
        unlocked = false
        LockResult.STORAGE_ERROR
      }
      }
    } finally {
      synchronized(mutex) { promptInFlight = false }
    }
  }
}
