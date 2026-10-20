package com.negresco.finance.security

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.Signature
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Ed25519 here is REAL; device enrollment and anti-rollback remain synthetic. */
internal fun runSignedDeviceProofScenarios() {
  val pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val other = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val id = SyntheticSignedDeviceProofLab.fingerprint(pair.public)
    ?: error("JDK did not provide a usable Ed25519 public key")
  val otherId = SyntheticSignedDeviceProofLab.fingerprint(other.public)
    ?: error("Missing other Ed25519 public key")
  check(id != otherId)
  val snapshot = SyntheticDeviceTrustPolicy.createSyntheticFirstDevice(id)
  val floor = DeviceTrustFloor(1L, 1L)
  val op = PresentedDeviceOperation(id, 1L, 1L, 1L,
    ProtectedOperation.EXPORT_FINANCIAL_DATA)
  fun nonce(): ByteArray = ByteArray(32).also { SecureRandom().nextBytes(it) }
  fun sign(pair: KeyPair, claim: PresentedDeviceOperation, challenge: ByteArray): ByteArray {
    val bytes = SyntheticSignedDeviceProofLab.canonicalPayload(claim, challenge)
    val signer = Signature.getInstance("Ed25519")
    signer.initSign(pair.private)
    signer.update(bytes)
    return signer.sign()
  }
  val challenge = nonce()
  val signature = sign(pair, op, challenge)
  fun verify(
    claim: PresentedDeviceOperation = op,
    publicKey: java.security.PublicKey? = pair.public,
    issued: ByteArray? = challenge,
    received: ByteArray? = challenge,
    signed: ByteArray? = signature
  ) = SyntheticSignedDeviceProofLab.verify(claim, publicKey, issued, received, signed)

  // 1. Signed original is verifiable, but is NOT an app authorization.
  check(verify())

  // 2. No trusted enrolled public key means no success.
  check(!verify(publicKey = null))

  // 3. A different signing key does not match the registered fingerprint.
  check(!verify(publicKey = other.public))

  // 4. One-bit mutation of signature is denied.
  val modified = signature.copyOf().also {
    it[it.lastIndex] = (it.last().toInt() xor 1).toByte()
  }
  check(!verify(signed = modified))

  // 5. Truncated/extended/missing signature is not accepted.
  check(!verify(signed = null))
  check(!verify(signed = signature.copyOf(63)))
  check(!verify(signed = signature + byteArrayOf(0)))

  // 6. Different authoritative nonce is not authorization for this operation.
  check(!verify(issued = nonce()))

  // 7. Different claimed challenge cannot borrow the old signature.
  check(!verify(received = nonce()))

  // 8. Absent/wrong sized challenge is always denied.
  check(!verify(issued = null))
  check(!verify(received = null))
  check(!verify(issued = ByteArray(0)))
  check(!verify(received = ByteArray(33)))

  // 9. Signed export is NOT signed revocation, even for same device.
  check(!verify(claim = op.copy(operation = ProtectedOperation.REVOKE_DEVICE)))

  // 10. Signed operation cannot be reused for a different sequence.
  check(!verify(claim = op.copy(sequence = 2L)))

  // 11. Signed operation cannot be reused in a different revocation epoch.
  check(!verify(claim = op.copy(registryRevision = 2L, epoch = 2L)))

  // 12. Signed operation cannot be reused for a different registry revision.
  check(!verify(claim = op.copy(registryRevision = 2L)))

  // 13. Signed operation cannot be substituted for a new public-key identity.
  check(!verify(claim = op.copy(fingerprint = otherId)))

  // 14. Invalid signing/counter values never produce canonical payload.
  for (invalid in listOf(op.copy(sequence = 0L),
    op.copy(sequence = Long.MAX_VALUE), op.copy(epoch = -1L),
    op.copy(registryRevision = 0L))) {
    check(runCatching {
      SyntheticSignedDeviceProofLab.canonicalPayload(invalid, challenge)
    }.isFailure)
    check(!verify(claim = invalid))
  }

  // 15. Canonical payload is operation, version, sequence and nonce bound.
  val payload = SyntheticSignedDeviceProofLab.canonicalPayload(op, challenge)
  check(!payload.contentEquals(SyntheticSignedDeviceProofLab.canonicalPayload(
    op.copy(operation = ProtectedOperation.REVEAL_SENSITIVE_RECORD), challenge)))
  check(!payload.contentEquals(SyntheticSignedDeviceProofLab.canonicalPayload(
    op, nonce())))

  // 16. Coordinator rejects forged proof WITHOUT consuming sequence.
  val coordinator = SyntheticDeviceTrustCoordinator(snapshot)
  check(coordinator.recordSignedSyntheticOperation(op, floor, pair.public,
    challenge, challenge, modified) == DeviceTrustGate.DENY_INVALID_DEVICE_SIGNATURE)
  check(coordinator.snapshotForLabOnly().lastSequence[id] == 0L)

  // 17. Genuine signature allows ONLY a synthetic atomic sequence record.
  check(coordinator.recordSignedSyntheticOperation(op, floor, pair.public,
    challenge, challenge, signature) == DeviceTrustGate.SYNTHETIC_SEQUENCE_RECORDED)
  check(coordinator.snapshotForLabOnly().lastSequence[id] == 1L)

  // 18. Replaying the same verified signature/counter is denied.
  check(coordinator.recordSignedSyntheticOperation(op, floor, pair.public,
    challenge, challenge, signature) == DeviceTrustGate.DENY_REPLAY_OR_INVALID_SEQUENCE)

  // 19. Authentic proof from revoked device still fails policy.
  check(coordinator.simulateRevocationAfterExternalProof(id, floor, true) ==
    DeviceTrustGate.SYNTHETIC_DEVICE_REVOKED)
  check(coordinator.recordSignedSyntheticOperation(op, floor, pair.public,
    challenge, challenge, signature) == DeviceTrustGate.DENY_REVOKED)

  // 20. Concurrent genuine signature uses can consume the counter ONLY once
  // in one JVM process. Durable recovery and nonce consumption still absent.
  val racing = SyntheticDeviceTrustCoordinator(snapshot)
  val pool = Executors.newFixedThreadPool(8)
  val latch = CountDownLatch(1)
  try {
    val futures = (1..12).map {
      pool.submit<DeviceTrustGate> {
        latch.await()
        racing.recordSignedSyntheticOperation(op, floor, pair.public,
          challenge, challenge, signature)
      }
    }
    latch.countDown()
    val results = futures.map { it.get(12L, TimeUnit.SECONDS) }
    check(results.count { it == DeviceTrustGate.SYNTHETIC_SEQUENCE_RECORDED } == 1)
    check(results.count { it == DeviceTrustGate.DENY_REPLAY_OR_INVALID_SEQUENCE } == 11)
  } finally {
    pool.shutdownNow()
  }

  // 21. A fresh challenge with higher signed counter works as NEW operation.
  val secondNonce = nonce()
  val second = op.copy(sequence = 2L)
  val secondSignature = sign(pair, second, secondNonce)
  // A new in-memory coordinator is used to model progression without revoking.
  val continuing = SyntheticDeviceTrustCoordinator(
    snapshot.copy(lastSequence = mapOf(id to 1L)))
  check(continuing.recordSignedSyntheticOperation(second, floor,
    pair.public, secondNonce, secondNonce, secondSignature) ==
    DeviceTrustGate.SYNTHETIC_SEQUENCE_RECORDED)
  check(continuing.recordSignedSyntheticOperation(op, floor, pair.public,
    challenge, challenge, signature) == DeviceTrustGate.DENY_REPLAY_OR_INVALID_SEQUENCE)

  // 22. Different algorithm identity is not Ed25519 proof.
  val rsa = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
  check(SyntheticSignedDeviceProofLab.fingerprint(rsa.public) == null)
  check(!verify(publicKey = rsa.public))

  // 23. RFC 8410 SPKI must contain exactly Ed25519 OID, never Ed448/XDH.
  fun syntheticPublicKey(spki: ByteArray): java.security.PublicKey =
    object : java.security.PublicKey {
      override fun getAlgorithm(): String = "Ed25519"
      override fun getFormat(): String = "X.509"
      override fun getEncoded(): ByteArray = spki.copyOf()
    }
  val spki = pair.public.encoded
  val wrongOid = spki.copyOf().also { it[8] = (it[8].toInt() xor 1).toByte() }
  check(SyntheticSignedDeviceProofLab.fingerprint(syntheticPublicKey(wrongOid)) == null)
  check(SyntheticSignedDeviceProofLab.fingerprint(syntheticPublicKey(spki + byteArrayOf(0))) == null)

  // 24. JCA interface/algorithm label is not the trust anchor. Only canonical
  // 44-byte SPKI plus a REAL Ed25519 signature can satisfy a signed proof.
  val portableSpki = syntheticPublicKey(spki)
  check(SyntheticSignedDeviceProofLab.fingerprint(portableSpki) == id)
  // Final authorization still requires cryptographic verification with
  // the actual enrolled key, not the fingerprint alone.
  check(SyntheticSignedDeviceProofLab.verify(op, pair.public, challenge,
    challenge, signature))

  println("PASS: 24 Ed25519 signed device proof scenarios (JVM only, no trusted enrollment)")
}
