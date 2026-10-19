package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.toMutablePreferences
import kotlinx.coroutines.flow.first

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

  /** A missing record is NOT interpreted as disabled or authenticated. */
  suspend fun read(): LockRecord? = decode(dataStore.data.first())

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
