package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Read-only adapter integration against a single owner per disposable file.
 * No user's DataStore, backup, SQLCipher, legacy migration or Expo bridge.
 * Writes below are fixture construction, NEVER a product feature.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticReadOnlyNativeLockReaderTest {
  private lateinit var sandbox: File
  private lateinit var scope: CoroutineScope
  private lateinit var datastore: DataStore<Preferences>
  private lateinit var reader: NativeLockReadOnlySnapshotReader
  private val version = intPreferencesKey("negresco.lock.protocol_version")
  private val enabled = booleanPreferencesKey("negresco.lock.enabled")
  private val revision = longPreferencesKey("negresco.lock.revision")
  private val pending = booleanPreferencesKey("negresco.lock.disable_pending")

  @Before fun setup() {
    val app = InstrumentationRegistry.getInstrumentation().targetContext
    sandbox = File(app.noBackupFilesDir, "negresco_read_only_${UUID.randomUUID()}")
    assertTrue("isolated random sandbox required", sandbox.mkdir())
    scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    // Exactly ONE DataStore factory/instance per fixture file in this process.
    datastore = PreferenceDataStoreFactory.create(scope = scope) {
      File(sandbox, "fixture.preferences_pb")
    }
    reader = NativeLockReadOnlySnapshotReader(datastore)
  }

  @After fun cleanup() = runBlocking {
    scope.coroutineContext[Job]!!.cancelAndJoin()
    assertTrue("delete isolated fixture only", sandbox.deleteRecursively())
  }

  private suspend fun fixture(
    lockEnabled: Boolean,
    pendingDisable: Boolean = false,
    lockRevision: Long = 3L
  ) {
    datastore.updateData { before ->
      before.toMutablePreferences().apply {
        this[version] = 1
        this[enabled] = lockEnabled
        this[revision] = lockRevision
        this[pending] = pendingDisable
      }
    }
  }

  @Test fun missingRecordDemandsVerifiedMigrationWithoutSeeding() = runBlocking {
    assertEquals("MISSING_REQUIRES_VERIFIED_MIGRATION", reader.inspectOnce())
    // No updateData call or new record is written by the reader.
    assertEquals("MISSING_REQUIRES_VERIFIED_MIGRATION", reader.inspectOnce())
  }

  @Test fun enabledAndDisabledSnapshotsAreNeverAuthorizations() = runBlocking {
    fixture(lockEnabled = true)
    assertEquals("VALID_UNTRUSTED", reader.inspectOnce())
    fixture(lockEnabled = false)
    assertEquals("VALID_UNTRUSTED", reader.inspectOnce())
  }

  @Test fun pendingDisableAlwaysStaysLocked() = runBlocking {
    fixture(lockEnabled = true, pendingDisable = true)
    assertEquals("PENDING_DISABLE_LOCKED", reader.inspectOnce())
    fixture(lockEnabled = false, pendingDisable = true)
    assertEquals("INVALID_LOCKED", reader.inspectOnce())
  }

  @Test fun wrongTypedPreferenceNeverGrantsAccess() = runBlocking {
    datastore.updateData { before ->
      before.toMutablePreferences().apply {
        this[version] = 1
        this[stringPreferencesKey("negresco.lock.enabled")] = "false"
        this[revision] = 3L
      }
    }
    assertEquals("INVALID_LOCKED", reader.inspectOnce())
  }

  @Test fun concurrentReadCallsShareOneFixtureDataStoreAndNeverMutate() = runBlocking {
    fixture(lockEnabled = true)
    val results = coroutineScope {
      (1..8).map { async { reader.inspectOnce() } }.awaitAll()
    }
    assertEquals(8, results.size)
    assertTrue(results.all { it == "VALID_UNTRUSTED" })
    // A real writer did not change the revision during these reads.
    assertEquals(3L, datastore.data.first()[revision])
  }
}
