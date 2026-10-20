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
import java.security.KeyPair
import java.security.KeyPairGenerator
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.security.Signature
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
  private val testEd25519Provider = BouncyCastleProvider()

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

  @Test fun deniedSecondAuthenticationRevokesPreviousGrantOnRealDataStore() = runBlocking {
    val fixture = open()
    fixture.repository.migrateLegacyLocked("enabled", null)
    var approve = true
    val coordinator = SuspendingNativeLockCoordinator(fixture.repository) { approve }
    coordinator.onForeground()
    assertEquals(LockResult.SUCCESS, coordinator.unlock())
    assertTrue(coordinator.snapshot().unlocked)

    // The prompt result is synthetic. DataStore and its persisted records are real.
    approve = false
    assertEquals(LockResult.DENIED, coordinator.unlock())
    assertFalse(coordinator.snapshot().unlocked)
    assertEquals(LockRecord(1, true, 0L), fixture.repository.read())
    approve = true
    assertEquals(LockResult.SUCCESS, coordinator.unlock())
  }

  @Test fun cancelledOptOutCannotRetainPriorGrantOrDisableRealDataStore() = runBlocking {
    val fixture = open()
    fixture.repository.migrateLegacyLocked("enabled", null)
    var cancelOptOut = false
    val coordinator = SuspendingNativeLockCoordinator(fixture.repository) { action ->
      if (cancelOptOut && action == LockAction.DISABLE)
        throw java.util.concurrent.CancellationException("synthetic biometric cancellation")
      true
    }
    coordinator.onForeground()
    assertEquals(LockResult.SUCCESS, coordinator.unlock())
    assertTrue(coordinator.snapshot().unlocked)

    cancelOptOut = true
    assertTrue(runCatching { coordinator.prepareDisableForLab() }.exceptionOrNull()
      is java.util.concurrent.CancellationException)
    assertFalse(coordinator.snapshot().unlocked)
    assertEquals(LockRecord(1, true, 0L), fixture.repository.read())
    assertEquals(LockResult.DENIED, coordinator.disable())
  }

  /**
   * STRICTLY SOFTWARE-ONLY Ed25519 keypairs on a disposable Android emulator.
   * AndroidKeyStore in this emulator returned EC/P-256 SPKI for an Ed25519
   * request. That is NOT Ed25519 and must NEVER pass proof verification.
   * A hardware-backed Ed25519/Keystore QA gate remains unresolved.
   *
   * The pinned Bouncy Castle provider is androidTestImplementation ONLY.
   * No private key is sent to an API, stored, or logged.
   */
  private fun createDisposableSoftwareEd25519KeyPair(): KeyPair =
    KeyPairGenerator.getInstance("Ed25519", testEd25519Provider).apply {
      initialize(org.bouncycastle.jcajce.spec.EdDSAParameterSpec("Ed25519"))
    }.generateKeyPair()

  private fun requireCanonicalLabFingerprint(key: java.security.PublicKey): DeviceKeyFingerprint =
    SyntheticSignedDeviceProofLab.fingerprint(key) ?: error(
      "Disposable Ed25519 SPKI rejected: algorithm=${key.algorithm} " +
        "format=${key.format} DER-length=${key.encoded?.size ?: -1}. " +
        "No private key or DER bytes are logged."
    )

  private fun signDeviceLab(
    key: KeyPair, claim: PresentedDeviceOperation, nonce: ByteArray
  ): ByteArray = Signature.getInstance("Ed25519", testEd25519Provider).run {
    initSign(key.private)
    update(SyntheticSignedDeviceProofLab.canonicalPayload(claim, nonce))
    sign()
  }

  @Test fun deviceChallengePersistsAndSingleUseSurvivesReopeningRealDataStore() =
    runBlocking {
      // This test uses an entirely separate disposable DataStore file.
      val file = File(isolatedDirectory, "device_challenge.preferences_pb")
      val pair = createDisposableSoftwareEd25519KeyPair()
      val id = requireCanonicalLabFingerprint(pair.public)
      val claim = PresentedDeviceOperation(id, 1L, 1L, 1L,
        ProtectedOperation.EXPORT_FINANCIAL_DATA)
      val floor = DeviceTrustFloor(1L, 1L)
      val first = Fixture(file).also { instances.add(it) }
      val ledger = SyntheticDeviceChallengeDataStoreLab(first.raw, testEd25519Provider)
      ledger.seedForDisposableLab(id)
      val challenge = ledger.issue(claim, floor)
      first.close()

      val reopened = Fixture(file).also { instances.add(it) }
      val afterRestart = SyntheticDeviceChallengeDataStoreLab(reopened.raw, testEd25519Provider)
      assertTrue(afterRestart.read()!!.pending!!.nonceCopy()
        .contentEquals(challenge.nonceCopy()))
      val signature = signDeviceLab(pair, claim, challenge.nonceCopy())
      assertEquals(1L, afterRestart.consume(claim, floor, pair.public,
        challenge.nonceCopy(), signature).lastSequence)
      reopened.close()

      val again = Fixture(file).also { instances.add(it) }
      val afterSecondRestart = SyntheticDeviceChallengeDataStoreLab(again.raw, testEd25519Provider)
      assertEquals(1L, afterSecondRestart.read()!!.lastSequence)
      assertNull(afterSecondRestart.read()!!.pending)
      assertTrue(runCatching { afterSecondRestart.consume(claim, floor, pair.public,
        challenge.nonceCopy(), signature) }.exceptionOrNull()
        is StaleSyntheticDeviceLedger)
    }

  @Test fun fakeSignatureDoesNotConsumeDeviceChallengeOnRealDataStore() = runBlocking {
    val file = File(isolatedDirectory, "device_invalid_signature.preferences_pb")
    val fixture = Fixture(file).also { instances.add(it) }
    val ledger = SyntheticDeviceChallengeDataStoreLab(fixture.raw, testEd25519Provider)
    val pair = createDisposableSoftwareEd25519KeyPair()
    val other = createDisposableSoftwareEd25519KeyPair()
    val id = requireCanonicalLabFingerprint(pair.public)
    val claim = PresentedDeviceOperation(id, 1L, 1L, 1L,
      ProtectedOperation.REVOKE_DEVICE)
    val floor = DeviceTrustFloor(1L, 1L)
    ledger.seedForDisposableLab(id)
    val issued = ledger.issue(claim, floor)
    val forged = signDeviceLab(other, claim, issued.nonceCopy())
    assertTrue(runCatching { ledger.consume(claim, floor, pair.public,
      issued.nonceCopy(), forged) }.exceptionOrNull() is UnverifiedSyntheticDeviceProof)
    assertEquals(0L, ledger.read()!!.lastSequence)
    assertTrue(ledger.read()!!.pending != null)
  }

  @Test fun racingValidSignedDeviceProofConsumesOneRealDataStoreTransaction() =
    runBlocking {
      val file = File(isolatedDirectory, "device_race.preferences_pb")
      val fixture = Fixture(file).also { instances.add(it) }
      val ledger = SyntheticDeviceChallengeDataStoreLab(fixture.raw, testEd25519Provider)
      val pair = createDisposableSoftwareEd25519KeyPair()
      val id = requireCanonicalLabFingerprint(pair.public)
      val claim = PresentedDeviceOperation(id, 1L, 1L, 1L,
        ProtectedOperation.EXPORT_FINANCIAL_DATA)
      val floor = DeviceTrustFloor(1L, 1L)
      ledger.seedForDisposableLab(id)
      val issued = ledger.issue(claim, floor)
      val sig = signDeviceLab(pair, claim, issued.nonceCopy())
      val outcomes = coroutineScope {
        (1..8).map { async {
          runCatching { ledger.consume(claim, floor, pair.public,
            issued.nonceCopy(), sig) }
        } }.map { it.await() }
      }
      assertEquals(1, outcomes.count { it.isSuccess })
      assertEquals(7, outcomes.count {
        it.exceptionOrNull() is StaleSyntheticDeviceLedger
      })
      assertEquals(1L, ledger.read()!!.lastSequence)
    }

  @Test fun cancelledSignedChallengeStaysInvalidAcrossAndroidDataStoreReopen() =
    runBlocking {
      val file = File(isolatedDirectory, "device_cancelled.preferences_pb")
      val pair = createDisposableSoftwareEd25519KeyPair()
      val id = requireCanonicalLabFingerprint(pair.public)
      val claim = PresentedDeviceOperation(id, 1L, 1L, 1L,
        ProtectedOperation.REVOKE_DEVICE)
      val floor = DeviceTrustFloor(1L, 1L)
      val first = Fixture(file).also { instances.add(it) }
      val ledger = SyntheticDeviceChallengeDataStoreLab(first.raw, testEd25519Provider)
      ledger.seedForDisposableLab(id)
      val issued = ledger.issue(claim, floor)
      val signed = signDeviceLab(pair, claim, issued.nonceCopy())
      assertEquals(2L,
        ledger.cancelPendingForDisposableLab(1L, 1L, floor).epoch)
      first.close()

      val reopened = Fixture(file).also { instances.add(it) }
      val afterRestart = SyntheticDeviceChallengeDataStoreLab(reopened.raw, testEd25519Provider)
      assertEquals(2L, afterRestart.read()!!.revision)
      assertNull(afterRestart.read()!!.pending)
      assertTrue(runCatching {
        afterRestart.consume(claim, floor, pair.public, issued.nonceCopy(), signed)
      }.exceptionOrNull() is StaleSyntheticDeviceLedger)
      assertEquals(0L, afterRestart.read()!!.lastSequence)
    }

  @Test fun signedAuthorityAndDeviceProofConsumeOneAndroidDataStoreCounter() =
    runBlocking {
      // Software-only keys, isolated DataStore and synthetic authority.
      // This test does NOT emulate production trust or server freshness.
      val file = File(isolatedDirectory, "authority_witness.preferences_pb")
      val device = createDisposableSoftwareEd25519KeyPair()
      val authority = createDisposableSoftwareEd25519KeyPair()
      val id = requireCanonicalLabFingerprint(device.public)
      val fixture = Fixture(file).also { instances.add(it) }
      val ledger = SyntheticDeviceChallengeDataStoreLab(fixture.raw,
        testEd25519Provider, authority.public)
      val claim = PresentedDeviceOperation(id, 1L, 1L, 1L,
        ProtectedOperation.EXPORT_FINANCIAL_DATA)
      val pending = ledger.seedForDisposableLab(id).let {
        ledger.issue(claim, DeviceTrustFloor(1L, 1L))
      }
      val authorityNonce = ByteArray(32).also {
        java.security.SecureRandom().nextBytes(it)
      }
      val floor = SignedFloorClaim(id, 1L, 1L, 0L)
      val authoritySig = Signature.getInstance("Ed25519", testEd25519Provider).run {
        initSign(authority.private)
        update(SyntheticSignedTrustFloorLab.payload(floor, authorityNonce))
        sign()
      }
      val deviceSig = signDeviceLab(device, claim, pending.nonceCopy())

      val changedChallenge = authorityNonce.copyOf().also {
        it[0] = (it[0].toInt() xor 1).toByte()
      }
      assertTrue(runCatching {
        ledger.consumeWithSignedAuthorityFloorForDisposableLab(
          claim, floor, changedChallenge, authorityNonce, authoritySig,
          device.public, pending.nonceCopy(), deviceSig)
      }.exceptionOrNull() is UnverifiedSyntheticAuthorityFloor)
      assertEquals(0L, ledger.read()!!.lastSequence)

      val saved = ledger.consumeWithSignedAuthorityFloorForDisposableLab(
        claim, floor, authorityNonce, authorityNonce, authoritySig,
        device.public, pending.nonceCopy(), deviceSig)
      assertEquals(1L, saved.lastSequence)
      assertNull(saved.pending)
      assertTrue(runCatching {
        ledger.consumeWithSignedAuthorityFloorForDisposableLab(
          claim, floor, authorityNonce, authorityNonce, authoritySig,
          device.public, pending.nonceCopy(), deviceSig)
      }.exceptionOrNull() is StaleSyntheticDeviceLedger)
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
