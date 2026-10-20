package com.negresco.finance.security

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.mutablePreferencesOf
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Android runtime evidence for the ISOLATED native-lock laboratory.
 *
 * Every fixture has a UUID-named noBackupFilesDir directory. Tests do not use
 * NativeLockAndroidStore's singleton, the Expo application's preference path,
 * biometric enrollment or any real financial data. Only our own files are
 * removed after cancelling ALL DataStore scopes.
 */
@RunWith(AndroidJUnit4::class)
class NativeLockDataStoreInstrumentedTest {
  private lateinit var isolatedDirectory: File
  private lateinit var dataFile: File
  private val instances = mutableListOf<Fixture>()

  private class Fixture(file: File) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    val raw: DataStore<Preferences> = PreferenceDataStoreFactory.create(scope = scope) { file }
    val repository = DataStoreLockRecordRepository(raw)
    suspend fun close() {
      scope.coroutineContext[Job]!!.cancelAndJoin()
    }
  }

  private fun open(): Fixture = Fixture(dataFile).also { instances.add(it) }

  @Before fun setUp() {
    val targetContext: Context = InstrumentationRegistry.getInstrumentation().targetContext
    isolatedDirectory = File(
      targetContext.noBackupFilesDir,
      "negresco_native_lock_instrumentation_" + UUID.randomUUID().toString()
    )
    assertTrue("Cannot create isolated lab directory", isolatedDirectory.mkdir())
    dataFile = File(isolatedDirectory, "lock.preferences_pb")
  }

  @After fun tearDown() = runBlocking {
    for (instance in instances.asReversed()) instance.close()
    assertTrue("Only lab fixture files are removed", isolatedDirectory.deleteRecursively())
  }

  @Test fun emptyStoreDoesNotEnableOrUnlockByDefault() = runBlocking {
    val store = open().repository
    assertNull(store.read())
    assertTrue(runCatching { store.enableIfCurrent(0L) }
      .exceptionOrNull() is MissingNativeLockRecord)
    assertNull(store.read())
  }

  @Test fun lockedLegacyMigrationPersistsAfterReopen() = runBlocking {
    val first = open()
    assertEquals(LockRecord(1, true, 0L),
      first.repository.migrateLegacyLocked("enabled", null))
    first.close()
    val reopened = open()
    assertEquals(LockRecord(1, true, 0L), reopened.repository.read())
  }

  @Test fun pendingDisableNeverCommitsOffEvenAfterReopen() = runBlocking {
    val first = open()
    first.repository.migrateLegacyLocked("enabled", null)
    assertEquals(LockRecord(1, true, 1L, disablePending = true),
      first.repository.prepareDisable(0L))
    first.close()
    val afterRestart = open().repository
    assertEquals(LockRecord(1, true, 1L, disablePending = true), afterRestart.read())
    assertEquals(LockRecord(1, true, 2L), afterRestart.recoverPreparedDisable())
    assertEquals(LockRecord(1, true, 2L), afterRestart.read())
  }

  @Test fun racingDisablePreparationsHaveExactlyOneWinner() = runBlocking {
    val repository = open().repository
    repository.migrateLegacyLocked("enabled", null)
    val outcome = coroutineScope {
      val one = async { runCatching { repository.prepareDisable(0L) } }
      val two = async { runCatching { repository.prepareDisable(0L) } }
      listOf(one.await(), two.await())
    }
    assertEquals(1, outcome.count { it.isSuccess })
    assertEquals(1, outcome.count { it.exceptionOrNull() is StaleNativeLockRevision })
    assertEquals(LockRecord(1, true, 1L, disablePending = true), repository.read())
  }

  @Test fun corruptedPendingOffRecordFailsClosedAcrossReopen() = runBlocking {
    val initial = open()
    initial.raw.updateData {
      mutablePreferencesOf(
        NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
        NativeLockDataStoreKeys.enabled to false,
        NativeLockDataStoreKeys.revision to 8L,
        NativeLockDataStoreKeys.disablePending to true
      )
    }
    assertTrue(runCatching { initial.repository.read() }
      .exceptionOrNull() is InvalidNativeLockRecord)
    assertTrue(runCatching { initial.repository.recoverPreparedDisable() }
      .exceptionOrNull() is InvalidNativeLockRecord)
    initial.close()
    val reopened = open().repository
    assertTrue(runCatching { reopened.read() }
      .exceptionOrNull() is InvalidNativeLockRecord)
  }

  @Test fun absentPersistedRecordRevokesPreviouslyUnlockedSession() = runBlocking {
    val fixture = open()
    fixture.repository.migrateLegacyLocked("enabled", null)
    val coordinator = SuspendingNativeLockCoordinator(fixture.repository) { true }
    coordinator.onForeground()
    assertEquals(LockResult.SUCCESS, coordinator.unlock())
    assertTrue(coordinator.snapshot().unlocked)

    // Remove ONLY the disposable Android DataStore record after login.
    fixture.raw.updateData { mutablePreferencesOf() }
    assertEquals(LockResult.MIGRATION_REQUIRED, coordinator.unlock())

    // Restoration of a valid synthetic record must NOT restore old access.
    fixture.raw.updateData {
      mutablePreferencesOf(
        NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
        NativeLockDataStoreKeys.enabled to true,
        NativeLockDataStoreKeys.revision to 0L
      )
    }
    assertFalse(coordinator.snapshot().unlocked)
    assertEquals(LockResult.SUCCESS, coordinator.unlock())
  }

  @Test fun malformedPersistedRecordRevokesPreviouslyUnlockedSession() = runBlocking {
    val fixture = open()
    fixture.repository.migrateLegacyLocked("enabled", null)
    val coordinator = SuspendingNativeLockCoordinator(fixture.repository) { true }
    coordinator.onForeground()
    assertEquals(LockResult.SUCCESS, coordinator.unlock())
    assertTrue(coordinator.snapshot().unlocked)

    // Partial record is CORRUPT, not a valid disabled preference.
    fixture.raw.updateData {
      mutablePreferencesOf(NativeLockDataStoreKeys.enabled to false)
    }
    assertEquals(LockResult.STORAGE_ERROR, coordinator.unlock())

    fixture.raw.updateData {
      mutablePreferencesOf(
        NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
        NativeLockDataStoreKeys.enabled to true,
        NativeLockDataStoreKeys.revision to 0L
      )
    }
    assertFalse(coordinator.snapshot().unlocked)
    assertEquals(LockResult.SUCCESS, coordinator.unlock())
  }

  @Test fun healthyEnabledRecordCannotBeDisabledByEnableOnlyWriter() = runBlocking {
    val store = open().repository
    store.migrateLegacyLocked("enabled", null)
    val failed = runCatching { store.enableIfCurrent(0L) }.exceptionOrNull()
    assertTrue(failed is AlreadyEnabledNativeLock)
    val record = store.read()
    assertEquals(LockRecord(1, true, 0L), record)
    assertFalse(record!!.disablePending)
  }
}
