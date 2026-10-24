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
  private var unlockedRevision: Long? = null
  private var promptInFlight = false

  fun onBackground() = synchronized(mutex) {
    generation++
    foreground = false
    unlocked = false
    unlockedRevision = null
  }

  fun onForeground() = synchronized(mutex) {
    foreground = true
    // Returning from background never restores a previously unlocked session.
  }

  fun lockNow() = synchronized(mutex) {
    generation++
    unlocked = false
    unlockedRevision = null
  }

  private fun validRecord(record: LockRecord?): LockRecord? {
    if (record == null) return null
    require(record.version == LOCK_RECORD_VERSION && record.revision >= 0L &&
      !(record.disablePending && !record.enabled)) {
      "Invalid native lock record"
    }
    return record
  }

  fun snapshot(): LockSnapshot = synchronized(mutex) {
    try {
      val record = validRecord(store.read()) ?: run {
        generation++
        unlocked = false
        unlockedRevision = null
        return@synchronized LockSnapshot(true, false, -1L, true, false)
      }
      if (unlocked && (!record.enabled || record.disablePending ||
          record.revision != unlockedRevision)) {
        generation++
        unlocked = false
        unlockedRevision = null
      }
      LockSnapshot(record.enabled,
        foreground && unlocked && record.enabled && !record.disablePending &&
          unlockedRevision == record.revision,
        record.revision, false, false)
    } catch (_: Exception) {
      generation++
      unlocked = false
      unlockedRevision = null
      LockSnapshot(true, false, -1L, false, true)
    }
  }

  private data class Attempt(val generation: Long, val revision: Long)

  private fun beginAttempt(action: LockAction): Pair<Attempt?, LockResult?> = synchronized(mutex) {
    if (!foreground || promptInFlight) return@synchronized null to LockResult.DENIED
    try {
      val record = validRecord(store.read())
        ?: return@synchronized null to LockResult.MIGRATION_REQUIRED
      promptInFlight = true
      if (record.disablePending ||
          (action == LockAction.ENABLE && record.enabled) ||
          (action == LockAction.UNLOCK && !record.enabled))
        return@synchronized null to LockResult.DENIED
      Attempt(generation, record.revision) to null
    } catch (_: Exception) {
      null to LockResult.STORAGE_ERROR
    }
  }

  /** Called only by the native adapter after a real native prompt. */
  fun request(action: LockAction): LockResult {
    // IMPORTANT: this legacy synchronous policy must not become an opt-out
    // bypass of the Android coroutine coordinator's DENIED decision.
    if (action == LockAction.DISABLE) return LockResult.DENIED
    val (attempt, failure) = beginAttempt(action)
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
          if (current.revision != ticket.revision || !current.enabled ||
              current.disablePending)
            return@synchronized LockResult.STALE
          unlockedRevision = current.revision
          unlocked = true
          return@synchronized LockResult.SUCCESS
        }
        // The only mutating action remaining in this legacy policy is ENABLE.
        val saved = store.update { previous ->
          val current = validRecord(previous)
            ?: throw IllegalStateException("Migration required")
          if (current.revision != ticket.revision || current.revision == Long.MAX_VALUE ||
              current.enabled || current.disablePending)
            throw IllegalStateException("Stale or exhausted revision")
          current.copy(enabled = true, revision = current.revision + 1L)
        }
        // The store is authoritative. Never trust a success return alone.
        if (saved.version != LOCK_RECORD_VERSION || saved.revision != ticket.revision + 1L ||
            !saved.enabled || saved.disablePending) {
          unlocked = false
          unlockedRevision = null
          return@synchronized LockResult.STORAGE_ERROR
        }
        unlocked = true
        unlockedRevision = saved.revision
        generation++
        LockResult.SUCCESS
      } catch (_: Exception) {
        unlocked = false
        unlockedRevision = null
        LockResult.STORAGE_ERROR
      }
      }
    } finally {
      synchronized(mutex) { promptInFlight = false }
    }
  }
}
