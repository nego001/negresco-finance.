package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * Real Jetpack DataStore transaction logic, compiled on JVM without Android.
 * This is NOT registered as an Expo module, not wired to NativeLockCoordinator,
 * and has no biometric authorizer. Never expose the repository directly to JS.
 *
 * An Android integration must use ONE process-scoped DataStore instance per
 * file and couple authorization with native lifecycle before allowing writes.
 */
internal object NativeLockDataStoreKeys {
  val version = intPreferencesKey("negresco.lock.protocol_version")
  val enabled = booleanPreferencesKey("negresco.lock.enabled")
  val revision = longPreferencesKey("negresco.lock.revision")
  val disablePending = booleanPreferencesKey("negresco.lock.disable_pending")
}

internal class MissingNativeLockRecord : IllegalStateException("Native lock requires verified migration")
internal class InvalidNativeLockRecord : IllegalStateException("Invalid native lock record")
internal class StaleNativeLockRevision : IllegalStateException("Native lock revision changed")
internal class PendingNativeLockDisable : IllegalStateException("Native lock disable already pending or not eligible")
internal class AlreadyEnabledNativeLock : IllegalStateException("Native lock is already enabled")

/**
 * An observation is a hint to REVOKE in-memory access, never an authorization.
 * Missing, malformed and unreadable records all close existing sessions.
 */
internal sealed interface NativeLockObservation {
  data class Record(val value: LockRecord) : NativeLockObservation
  data object Missing : NativeLockObservation
  data object StorageError : NativeLockObservation
}

internal class DataStoreLockRecordRepository(private val dataStore: DataStore<Preferences>) {
  private fun decode(prefs: Preferences): LockRecord? {
    val version = prefs[NativeLockDataStoreKeys.version]
    val enabled = prefs[NativeLockDataStoreKeys.enabled]
    val revision = prefs[NativeLockDataStoreKeys.revision]
    val pending = prefs[NativeLockDataStoreKeys.disablePending]
    if (version == null && enabled == null && revision == null && pending == null) return null
    if (version == null || enabled == null || revision == null ||
        version != LOCK_RECORD_VERSION || revision < 0L ||
        (pending == true && !enabled)) {
      throw InvalidNativeLockRecord()
    }
    return LockRecord(version, enabled, revision, pending == true)
  }

  /**
   * Emits persisted changes for the native Activity observer. A decoding/I/O
   * failure becomes StorageError, not enabled=false or a silently empty record.
   * A failed stream terminates after the error; the host must keep access
   * revoked and perform explicit recovery before trying to observe again.
   */
  fun observe(): Flow<NativeLockObservation> = dataStore.data
    .map { prefs ->
      val record = decode(prefs)
      if (record == null) NativeLockObservation.Missing
      else NativeLockObservation.Record(record)
    }
    .catch { error ->
      if (error is CancellationException) throw error
      emit(NativeLockObservation.StorageError)
    }
    .distinctUntilChanged()

  /** A missing record is NOT interpreted as disabled or authenticated. */
  suspend fun read(): LockRecord? = decode(dataStore.data.first())

  /**
   * One-time, locked-only seed using a verified legacy snapshot.
   * An existing native record always wins, even if legacy data was deleted.
   * Never initializes disabled/off or overwrites an existing native revision.
   *
   * The future Android adapter must obtain the legacy snapshot internally
   * during a controlled migration, not accept arbitrary values from JS.
   */
  suspend fun migrateLegacyLocked(
    legacyPreference: String?,
    legacyJournal: String?
  ): LockRecord {
    val committed = dataStore.updateData { before ->
      if (decode(before) != null) return@updateData before
      when (classifyLegacyLock(legacyPreference, legacyJournal)) {
        LegacyLockMigrationDecision.PRESERVE_LOCK -> before.toMutablePreferences().apply {
          this[NativeLockDataStoreKeys.version] = LOCK_RECORD_VERSION
          this[NativeLockDataStoreKeys.enabled] = true
          this[NativeLockDataStoreKeys.revision] = 0L
        }
        LegacyLockMigrationDecision.NEEDS_EXPLICIT_SETUP ->
          throw LegacyLockSetupRequired()
        LegacyLockMigrationDecision.REJECT_INVALID ->
          throw LegacyLockInvalid()
      }
    }
    return decode(committed) ?: throw InvalidNativeLockRecord()
  }

  /**
   * The only generic state change permitted by the production-facing
   * repository is ENABLE. There is intentionally no Boolean target and
   * no method that can persist enabled=false from this adapter.
   *
   * A native-only coordinator must authorize this operation before calling.
   * It must never be exported to JavaScript.
   */
  suspend fun enableIfCurrent(expectedRevision: Long): LockRecord {
    val committed = dataStore.updateData { before ->
      val previous = decode(before) ?: throw MissingNativeLockRecord()
      if (previous.revision != expectedRevision || previous.revision == Long.MAX_VALUE) {
        throw StaleNativeLockRevision()
      }
      if (previous.disablePending) throw PendingNativeLockDisable()
      if (previous.enabled) throw AlreadyEnabledNativeLock()
      before.toMutablePreferences().apply {
        this[NativeLockDataStoreKeys.version] = LOCK_RECORD_VERSION
        this[NativeLockDataStoreKeys.enabled] = true
        this[NativeLockDataStoreKeys.revision] = previous.revision + 1L
      }
    }
    return decode(committed) ?: throw InvalidNativeLockRecord()
  }

  /**
   * Phase 1 only. Durable preparation never writes enabled=false.
   * Strong biometric approval and lifecycle validation are the caller's job.
   * A process crash can leave PREPARED, but never a disabled lock.
   */
  suspend fun prepareDisable(expectedRevision: Long): LockRecord {
    val committed = dataStore.updateData { before ->
      val current = decode(before) ?: throw MissingNativeLockRecord()
      if (current.revision != expectedRevision || current.revision == Long.MAX_VALUE)
        throw StaleNativeLockRevision()
      if (!current.enabled || current.disablePending) throw PendingNativeLockDisable()
      before.toMutablePreferences().apply {
        this[NativeLockDataStoreKeys.enabled] = true
        this[NativeLockDataStoreKeys.disablePending] = true
        this[NativeLockDataStoreKeys.revision] = current.revision + 1L
      }
    }
    return decode(committed) ?: throw InvalidNativeLockRecord()
  }

  /**
   * Safe startup recovery: always re-arms the lock. Cannot opt out.
   * Does not rewrite intact records or erase legacy data.
   */
  suspend fun recoverPreparedDisable(): LockRecord? {
    val committed = dataStore.updateData { before ->
      val current = decode(before) ?: return@updateData before
      if (!current.disablePending) return@updateData before
      if (!current.enabled || current.revision == Long.MAX_VALUE)
        throw InvalidNativeLockRecord()
      before.toMutablePreferences().apply {
        this[NativeLockDataStoreKeys.enabled] = true
        remove(NativeLockDataStoreKeys.disablePending)
        this[NativeLockDataStoreKeys.revision] = current.revision + 1L
      }
    }
    return decode(committed)
  }
}
