package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Android DataStore fixture tests with disposable, per-test random files.
 * NEVER touches the app's negresco_native_lock.preferences_pb, preferences
 * migration, user biometrics, financial databases or Keystore.
 *
 * Tests typed parsing only. The classifier is not exported to JavaScript and
 * no test result is an authority to unlock or disable local protection.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticTypedNativeLockSnapshotTest {
  private lateinit var fixtureDir: File
  private lateinit var scope: CoroutineScope
  private lateinit var store: DataStore<Preferences>

  private val version = intPreferencesKey("negresco.lock.protocol_version")
  private val enabled = booleanPreferencesKey("negresco.lock.enabled")
  private val revision = longPreferencesKey("negresco.lock.revision")
  private val pending = booleanPreferencesKey("negresco.lock.disable_pending")

  @Before fun setup() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    fixtureDir = File(context.noBackupFilesDir,
      "negresco_typed_only_" + UUID.randomUUID().toString())
    assertTrue(fixtureDir.mkdir())
    scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    store = PreferenceDataStoreFactory.create(scope = scope) {
      File(fixtureDir, "synthetic.preferences_pb")
    }
  }

  @After fun cleanup() = runBlocking {
    scope.coroutineContext[Job]!!.cancelAndJoin()
    assertTrue("delete fixture directory only", fixtureDir.deleteRecursively())
  }

  private suspend fun setRecord(
    protocol: Int = 1,
    lockEnabled: Boolean = true,
    currentRevision: Long = 4L,
    disablePending: Boolean? = null
  ) {
    store.updateData { original ->
      original.toMutablePreferences().apply {
        this[version] = protocol
        this[enabled] = lockEnabled
        this[revision] = currentRevision
        if (disablePending == null) remove(pending)
        else this[pending] = disablePending
      }
    }
  }

  @Test fun missingSnapshotRequiresVerifiedMigration() = runBlocking {
    assertEquals("MISSING_REQUIRES_VERIFIED_MIGRATION",
      NativeLockTypedSnapshotClassifier.classify(store.data.first()))
  }

  @Test fun enabledSnapshotStillCannotBeTrustedToUnlock() = runBlocking {
    setRecord()
    assertEquals("VALID_UNTRUSTED",
      NativeLockTypedSnapshotClassifier.classify(store.data.first()))
  }

  @Test fun disabledSnapshotNeverBecomesAutomaticOptOut() = runBlocking {
    setRecord(lockEnabled = false)
    assertEquals("VALID_UNTRUSTED",
      NativeLockTypedSnapshotClassifier.classify(store.data.first()))
    // The result is syntax-only, not a granted unlocked session.
  }

  @Test fun pendingDisableMustStayLocked() = runBlocking {
    setRecord(disablePending = true)
    assertEquals("PENDING_DISABLE_LOCKED",
      NativeLockTypedSnapshotClassifier.classify(store.data.first()))
  }

  @Test fun contradictoryPendingDisableIsInvalid() = runBlocking {
    setRecord(lockEnabled = false, disablePending = true)
    assertEquals("INVALID_LOCKED",
      NativeLockTypedSnapshotClassifier.classify(store.data.first()))
  }

  @Test fun negativeRevisionIsInvalid() = runBlocking {
    setRecord(currentRevision = -1L)
    assertEquals("INVALID_LOCKED",
      NativeLockTypedSnapshotClassifier.classify(store.data.first()))
  }

  @Test fun unknownSchemaCannotBecomeUnlocked() = runBlocking {
    setRecord(protocol = 2)
    assertEquals("UNSUPPORTED_VERSION_LOCKED",
      NativeLockTypedSnapshotClassifier.classify(store.data.first()))
  }

  @Test fun missingMandatoryFieldNeverCreatesDisabledPermission() = runBlocking {
    store.updateData { prefs ->
      prefs.toMutablePreferences().apply {
        this[version] = 1
        this[enabled] = false
        // No revision; fail closed without synthesizing one.
      }
    }
    assertEquals("INVALID_LOCKED",
      NativeLockTypedSnapshotClassifier.classify(store.data.first()))
  }
}
