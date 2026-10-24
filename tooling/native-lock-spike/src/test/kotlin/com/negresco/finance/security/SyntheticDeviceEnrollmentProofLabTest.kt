package com.negresco.finance.security

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PublicKey
import java.security.SecureRandom
import java.security.Signature

/**
 * 20 adversarial enrollment proofs. NO account, authenticated registry,
 * enrollment authority, server nonce ledger or device enrollment is created.
 */
internal fun runSyntheticDeviceEnrollmentProofScenarios() {
  val approving = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val candidate = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val unknown = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val approvingId = SyntheticSignedDeviceProofLab.fingerprint(approving.public)!!
  val candidateId = SyntheticSignedDeviceProofLab.fingerprint(candidate.public)!!
  val unknownId = SyntheticSignedDeviceProofLab.fingerprint(unknown.public)!!
  val registry = SyntheticDeviceTrustPolicy.createSyntheticFirstDevice(approvingId)
  val floor = DeviceTrustFloor(1L, 1L)
  val intent = SyntheticDeviceEnrollmentIntent(approvingId, candidateId, 1L, 1L, 1L)
  val challenge = ByteArray(32).also { SecureRandom().nextBytes(it) }
  fun sign(pair: KeyPair, value: SyntheticDeviceEnrollmentIntent = intent,
    nonce: ByteArray = challenge, candidateRole: Boolean) =
    Signature.getInstance("Ed25519").run {
      initSign(pair.private)
      update(SyntheticDeviceEnrollmentProofLab.payload(value, nonce, candidateRole))
      sign()
    }
  val approvingSignature = sign(approving, candidateRole = false)
  val candidateSignature = sign(candidate, candidateRole = true)
  fun inspect(
    state: DeviceTrustSnapshot? = registry,
    trustedFloor: DeviceTrustFloor? = floor,
    request: SyntheticDeviceEnrollmentIntent = intent,
    approvingKey: PublicKey? = approving.public,
    candidateKey: PublicKey? = candidate.public,
    issued: ByteArray? = challenge,
    returned: ByteArray? = challenge,
    oldSignature: ByteArray? = approvingSignature,
    newSignature: ByteArray? = candidateSignature
  ) = SyntheticDeviceEnrollmentProofLab.inspect(state, trustedFloor, request,
    approvingKey, candidateKey, issued, returned, oldSignature, newSignature)

  val ready = SyntheticEnrollmentGate.PROCEED_TO_INDEPENDENT_PERSISTENT_ENROLLMENT_PROTOCOL

  // 1. Two different correctly signing keys advance ONLY to another protocol.
  check(inspect() == ready)

  // 2. No local registry means no enrollment.
  check(inspect(state = null) == SyntheticEnrollmentGate.DENY_MALFORMED_REGISTRY)

  // 3. Corrupt or conflicting registries fail closed.
  check(inspect(state = registry.copy(active = emptySet(), revoked = emptySet())) ==
    SyntheticEnrollmentGate.DENY_MALFORMED_REGISTRY)
  check(inspect(state = registry.copy(revoked = setOf(approvingId))) ==
    SyntheticEnrollmentGate.DENY_MALFORMED_REGISTRY)

  // 4. No independently protected revision/epoch floor means denial.
  check(inspect(trustedFloor = null) == SyntheticEnrollmentGate.DENY_UNTRUSTED_FLOOR)

  // 5. Restored registry older than floor is denied.
  check(inspect(trustedFloor = DeviceTrustFloor(2L, 2L)) ==
    SyntheticEnrollmentGate.DENY_UNTRUSTED_FLOOR)

  // 6. Enrollment claim for a stale revision/epoch is denied.
  check(inspect(request = intent.copy(revision = 2L)) ==
    SyntheticEnrollmentGate.DENY_STALE_REGISTRY)
  check(inspect(request = intent.copy(epoch = 2L, revision = 2L)) ==
    SyntheticEnrollmentGate.DENY_STALE_REGISTRY)

  // 7. Applicant cannot simply approve itself.
  check(inspect(request = intent.copy(approvingDevice = candidateId)) ==
    SyntheticEnrollmentGate.DENY_UNTRUSTED_APPROVER)

  // 8. Unknown previous "approver" cannot enroll another device.
  check(inspect(request = intent.copy(approvingDevice = unknownId)) ==
    SyntheticEnrollmentGate.DENY_UNTRUSTED_APPROVER)

  // 9. Existing approved key cannot be reenrolled as a new candidate.
  check(inspect(request = intent.copy(candidateDevice = approvingId)) ==
    SyntheticEnrollmentGate.DENY_UNTRUSTED_APPROVER)

  // 10. Revoked candidate cannot reenroll without separate recovery.
  check(inspect(state = registry.copy(revoked = setOf(candidateId))) ==
    SyntheticEnrollmentGate.DENY_DUPLICATE_OR_REVOKED_CANDIDATE)

  // 11. A candidate already active cannot duplicate enrollment.
  check(inspect(state = registry.copy(active = setOf(approvingId, candidateId))) ==
    SyntheticEnrollmentGate.DENY_DUPLICATE_OR_REVOKED_CANDIDATE)

  // 12. Stale/reused sequence is denied independently of two signatures.
  check(inspect(state = registry.copy(lastSequence = mapOf(approvingId to 1L))) ==
    SyntheticEnrollmentGate.DENY_INVALID_SEQUENCE)
  check(inspect(request = intent.copy(approvingSequence = 0L)) ==
    SyntheticEnrollmentGate.DENY_INVALID_SEQUENCE)

  // 13. Missing or altered issuer challenge cannot authenticate enrollment.
  check(inspect(issued = null) == SyntheticEnrollmentGate.DENY_INVALID_CHALLENGE)
  check(inspect(returned = null) == SyntheticEnrollmentGate.DENY_INVALID_CHALLENGE)
  check(inspect(issued = ByteArray(31)) == SyntheticEnrollmentGate.DENY_INVALID_CHALLENGE)
  val different = challenge.copyOf().also {
    it[0] = (it[0].toInt() xor 1).toByte()
  }
  check(inspect(returned = different) == SyntheticEnrollmentGate.DENY_INVALID_CHALLENGE)

  // 14. Untrusted/missing previous public key is not a registered approver.
  check(inspect(approvingKey = null) == SyntheticEnrollmentGate.DENY_UNTRUSTED_PUBLIC_KEY)
  check(inspect(approvingKey = unknown.public) ==
    SyntheticEnrollmentGate.DENY_UNTRUSTED_PUBLIC_KEY)

  // 15. Applicant must prove possession of its OWN precise Ed25519 key.
  check(inspect(candidateKey = null) == SyntheticEnrollmentGate.DENY_UNTRUSTED_PUBLIC_KEY)
  check(inspect(candidateKey = unknown.public) ==
    SyntheticEnrollmentGate.DENY_UNTRUSTED_PUBLIC_KEY)

  // 16. One party alone is not enough.
  check(inspect(oldSignature = null) == SyntheticEnrollmentGate.DENY_APPROVAL_SIGNATURE)
  check(inspect(newSignature = null) == SyntheticEnrollmentGate.DENY_CANDIDATE_SIGNATURE)

  // 17. Candidate signature cannot be used as approver signature or vice versa.
  check(inspect(oldSignature = candidateSignature) ==
    SyntheticEnrollmentGate.DENY_APPROVAL_SIGNATURE)
  check(inspect(newSignature = approvingSignature) ==
    SyntheticEnrollmentGate.DENY_CANDIDATE_SIGNATURE)

  // 18. Tampering any legitimate signature is denied.
  val badOld = approvingSignature.copyOf().also {
    it[0] = (it[0].toInt() xor 1).toByte()
  }
  val badNew = candidateSignature.copyOf().also {
    it[0] = (it[0].toInt() xor 1).toByte()
  }
  check(inspect(oldSignature = badOld) == SyntheticEnrollmentGate.DENY_APPROVAL_SIGNATURE)
  check(inspect(newSignature = badNew) == SyntheticEnrollmentGate.DENY_CANDIDATE_SIGNATURE)

  // 19. Candidate identities cannot be swapped after getting two signatures.
  check(inspect(request = intent.copy(candidateDevice = unknownId)) ==
    SyntheticEnrollmentGate.DENY_UNTRUSTED_PUBLIC_KEY)

  // 20. Neither a successful proof nor a local Boolean creates enrollment.
  check(registry.active == setOf(approvingId))
  check(candidateId !in registry.active)
  check(SyntheticEnrollmentGate.entries.none {
    it.name == "ALLOW" || it.name == "ENROLLED" || it.name == "UNLOCKED"
  })
  println("PASS: 20 dual-signature device enrollment preflight scenarios (JVM only, no authenticated issuer)")
}
