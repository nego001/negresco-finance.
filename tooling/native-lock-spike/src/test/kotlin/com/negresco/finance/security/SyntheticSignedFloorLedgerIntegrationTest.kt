package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import java.io.File
import java.nio.file.Files
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.Signature
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope

/** All keys and files belong to disposable JVM fixtures, never user data. */
private class WitnessStoreHarness(file: File, trustedAuthority: java.security.PublicKey?) {
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private val data: DataStore<Preferences> = PreferenceDataStoreFactory.create(scope = scope) { file }
  val ledger = SyntheticDeviceChallengeDataStoreLab(data,
    labTrustedAuthorityKey = trustedAuthority)
  suspend fun close() { scope.coroutineContext[Job]!!.cancelAndJoin() }
}

internal suspend fun runSignedAuthorityLedgerIntegrationScenarios() {
  val device = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val server = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val impostor = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val id = SyntheticSignedDeviceProofLab.fingerprint(device.public)!!
  val rng = SecureRandom()
  fun nonce() = ByteArray(32).also { rng.nextBytes(it) }
  fun sign(key: KeyPair, data: ByteArray) = Signature.getInstance("Ed25519").run {
    initSign(key.private)
    update(data)
    sign()
  }
  val base = PresentedDeviceOperation(id, 1L, 1L, 1L,
    ProtectedOperation.EXPORT_FINANCIAL_DATA)
  val minimum = DeviceTrustFloor(1L, 1L)
  val remote = SignedFloorClaim(id, 1L, 1L, 0L)

  suspend fun fixture(block: suspend (WitnessStoreHarness) -> Unit) {
    val dir = Files.createTempDirectory("negresco-signed-floor-fixture-").toFile()
    val h = WitnessStoreHarness(File(dir, "ledger.preferences_pb"), server.public)
    try { block(h) } finally { h.close(); check(dir.deleteRecursively()) }
  }

  suspend fun prepare(h: WitnessStoreHarness): Pair<ByteArray, ByteArray> {
    h.ledger.seedForDisposableLab(id)
    val pending = h.ledger.issue(base, minimum)
    val issued = nonce()
    return pending.nonceCopy() to issued
  }

  suspend fun attempt(
    h: WitnessStoreHarness,
    deviceNonce: ByteArray,
    authorityChallenge: ByteArray,
    floor: SignedFloorClaim = remote,
    authorityKey: KeyPair = server,
    deviceKey: KeyPair = device,
    claim: PresentedDeviceOperation = base,
    echoed: ByteArray = authorityChallenge,
    authoritySignature: ByteArray =
      sign(authorityKey, SyntheticSignedTrustFloorLab.payload(floor, authorityChallenge)),
    deviceSignature: ByteArray =
      sign(deviceKey, SyntheticSignedDeviceProofLab.canonicalPayload(base, deviceNonce))
  ): SyntheticLedgerView = h.ledger.consumeWithSignedAuthorityFloorForDisposableLab(
    claim, floor, authorityChallenge, echoed, authoritySignature,
    device.public, deviceNonce, deviceSignature
  )

  // 1. Valid two-signature proof only records a disposable counter, no grant.
  fixture { h ->
    val (d, a) = prepare(h)
    val after = attempt(h, d, a)
    check(after.lastSequence == 1L && after.pending == null)
  }

  // 2. Same challenge and signatures cannot consume a second time.
  fixture { h ->
    val (d, a) = prepare(h)
    attempt(h, d, a)
    check(runCatching { attempt(h, d, a) }.exceptionOrNull()
      is StaleSyntheticDeviceLedger)
  }

  // 3. Fake authority signature denies BEFORE consuming device nonce.
  fixture { h ->
    val (d, a) = prepare(h)
    check(runCatching { attempt(h, d, a, authorityKey = impostor) }
      .exceptionOrNull() is UnverifiedSyntheticAuthorityFloor)
    check(h.ledger.read()!!.pending != null && h.ledger.read()!!.lastSequence == 0L)
  }

  // 4. A freshly challenged response cannot borrow an old signature.
  fixture { h ->
    val (d, a) = prepare(h)
    val other = nonce()
    val old = sign(server, SyntheticSignedTrustFloorLab.payload(remote, a))
    check(runCatching { attempt(h, d, other, authoritySignature = old) }
      .exceptionOrNull() is UnverifiedSyntheticAuthorityFloor)
    check(h.ledger.read()!!.pending != null)
  }

  // 5. Missing "pinned" fixture authority must block the operation.
  run {
    val dir = Files.createTempDirectory("negresco-no-authority-").toFile()
    val h = WitnessStoreHarness(File(dir, "ledger.preferences_pb"), null)
    try {
      val (d, a) = prepare(h)
      check(runCatching { attempt(h, d, a) }.exceptionOrNull()
        is UnverifiedSyntheticAuthorityFloor)
      check(h.ledger.read()!!.lastSequence == 0L)
    } finally { h.close(); check(dir.deleteRecursively()) }
  }

  // 6. Verified authority floor from a later revision rejects local replay.
  fixture { h ->
    val (d, a) = prepare(h)
    val newFloor = remote.copy(revision = 2L, epoch = 2L)
    check(runCatching { attempt(h, d, a, floor = newFloor) }
      .exceptionOrNull() is UnverifiedSyntheticAuthorityFloor)
    check(h.ledger.read()!!.lastSequence == 0L)
  }

  // 7. A valid authority floor cannot rescue a forged device signature.
  fixture { h ->
    val (d, a) = prepare(h)
    val forged = sign(impostor, SyntheticSignedDeviceProofLab.canonicalPayload(base, d))
    check(runCatching { attempt(h, d, a, deviceSignature = forged) }
      .exceptionOrNull() is UnverifiedSyntheticDeviceProof)
    check(h.ledger.read()!!.pending != null)
  }

  // 8. Signed floor for another device remains denied.
  fixture { h ->
    val (d, a) = prepare(h)
    val unknown = SyntheticSignedDeviceProofLab.fingerprint(impostor.public)!!
    check(runCatching { attempt(h, d, a, floor = remote.copy(subject = unknown)) }
      .exceptionOrNull() is UnverifiedSyntheticAuthorityFloor)
  }

  // 9. Cancellation between signing and consumption defeats both signatures.
  fixture { h ->
    val (d, a) = prepare(h)
    val oldAuthoritySig = sign(server, SyntheticSignedTrustFloorLab.payload(remote, a))
    val oldDeviceSig = sign(device, SyntheticSignedDeviceProofLab.canonicalPayload(base, d))
    h.ledger.cancelPendingForDisposableLab(1L, 1L, minimum)
    check(runCatching { attempt(h, d, a, authoritySignature = oldAuthoritySig,
      deviceSignature = oldDeviceSig) }.exceptionOrNull() is UnverifiedSyntheticAuthorityFloor)
    check(h.ledger.read()!!.epoch == 2L && h.ledger.read()!!.pending == null)
  }

  // 10. Race: only one verified two-signature operation commits.
  fixture { h ->
    val (d, a) = prepare(h)
    val authSig = sign(server, SyntheticSignedTrustFloorLab.payload(remote, a))
    val deviceSig = sign(device, SyntheticSignedDeviceProofLab.canonicalPayload(base, d))
    val outcomes = coroutineScope {
      (1..12).map { async(Dispatchers.IO) { runCatching {
        attempt(h, d, a, authoritySignature = authSig, deviceSignature = deviceSig)
      } } }.map { it.await() }
    }
    check(outcomes.count { it.isSuccess } == 1)
    check(outcomes.count { it.exceptionOrNull() is StaleSyntheticDeviceLedger } == 11)
    check(h.ledger.read()!!.lastSequence == 1L)
  }

  // 11. Correct signed minimum 1 rejects a rollback to unconsumed sequence 0.
  fixture { h ->
    val (d, a) = prepare(h)
    val advancedFloor = remote.copy(minLastSequence = 1L)
    check(runCatching { attempt(h, d, a, floor = advancedFloor) }
      .exceptionOrNull() is UnverifiedSyntheticAuthorityFloor)
  }

  // 12. Same signatures cannot be redirected to another operation.
  fixture { h ->
    val (d, a) = prepare(h)
    check(runCatching { attempt(h, d, a, claim =
      base.copy(operation = ProtectedOperation.REVOKE_DEVICE)) }
      .exceptionOrNull() is StaleSyntheticDeviceLedger)
    check(h.ledger.read()!!.lastSequence == 0L)
  }

  println("PASS: 12 signed-floor plus device-proof atomic DataStore scenarios (JVM lab, no trusted issuer)")
}
