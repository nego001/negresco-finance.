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
 * and has no biometric authorizer. Never expose compareAndSet directly to JS.
 *
 * An Android integration must use ONE process-scoped DataStore instance per
 * file and couple authorization with native lifecycle before allowing writes.
 */
internal object NativeLockDataStoreKeys {
  val version = intPreferencesKey("negresco.lock.protocol_version")
  val enabled = booleanPreferencesKey("negresco.lock.enabled")
  val revision = longPreferencesKey("negresco.lock.revision")
}

internal class MissingNativeLockRecord : IllegalStateException("Native lock requires verified migration")
internal class InvalidNativeLockRecord : IllegalStateException("Invalid native lock record")
internal class StaleNativeLockRevision : IllegalStateException("Native lock revision changed")

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
    if (version == null && enabled == null && revision == null) return null
    if (version == null || enabled == null || revision == null ||
        version != LOCK_RECORD_VERSION || revision < 0L) {
      throw InvalidNativeLockRecord()
    }
    return LockRecord(version, enabled, revision)
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
   * Atomic read/compare/update of all fields, persisted when updateData returns.
   * This method requires a future native biometric authorization boundary.
   * It must never be called from a JavaScript bridge directly.
   */
  suspend fun compareAndSet(expectedRevision: Long, targetEnabled: Boolean): LockRecord {
    val committed = dataStore.updateData { before ->
      val previous = decode(before) ?: throw MissingNativeLockRecord()
      if (previous.revision != expectedRevision || previous.revision == Long.MAX_VALUE) {
        throw StaleNativeLockRevision()
      }
      before.toMutablePreferences().apply {
        this[NativeLockDataStoreKeys.version] = LOCK_RECORD_VERSION
        this[NativeLockDataStoreKeys.enabled] = targetEnabled
        this[NativeLockDataStoreKeys.revision] = previous.revision + 1L
      }
    }
    return decode(committed) ?: throw InvalidNativeLockRecord()
  }
}
