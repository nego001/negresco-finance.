package com.negresco.finance.security

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Provider
import java.security.Signature

/**
 * SEC-05: two-party SIGNATURE VERIFICATION for an experimental new-device
 * enrollment request. This does not enroll any device or release privileges.
 *
 * STILL LAB ONLY. No enrollment server, trusted device registry issuer,
 * owner strong-auth result, authenticated account identity, hardware keys,
 * persistent nonce consumption, durable monotonic counters or Expo module
 * are implemented. Caller's "alreadyApprovedDeviceKey" is NOT authenticated
 * by this lab. Only an independent protected registry could supply it.
 */
internal data class SyntheticDeviceEnrollmentIntent(
  val approvingDevice: DeviceKeyFingerprint,
  val candidateDevice: DeviceKeyFingerprint,
  val revision: Long,
  val epoch: Long,
  val approvingSequence: Long
)

internal enum class SyntheticEnrollmentGate {
  DENY_MALFORMED_REGISTRY,
  DENY_UNTRUSTED_FLOOR,
  DENY_STALE_REGISTRY,
  DENY_UNTRUSTED_APPROVER,
  DENY_DUPLICATE_OR_REVOKED_CANDIDATE,
  DENY_INVALID_SEQUENCE,
  DENY_INVALID_CHALLENGE,
  DENY_UNTRUSTED_PUBLIC_KEY,
  DENY_APPROVAL_SIGNATURE,
  DENY_CANDIDATE_SIGNATURE,
  PROCEED_TO_INDEPENDENT_PERSISTENT_ENROLLMENT_PROTOCOL
}

internal object SyntheticDeviceEnrollmentProofLab {
  private val approvalDomain = "negresco.finance.device-enrollment.approver.ed25519.v1"
    .toByteArray(StandardCharsets.US_ASCII)
  private val possessionDomain = "negresco.finance.device-enrollment.candidate.ed25519.v1"
    .toByteArray(StandardCharsets.US_ASCII)
  private const val NONCE_SIZE = 32
  private const val ED25519_SIGNATURE_SIZE = 64

  /** Same unambiguous bytes for each party, but distinct signing domains. */
  fun payload(
    intent: SyntheticDeviceEnrollmentIntent,
    nonce: ByteArray,
    candidateSignature: Boolean
  ): ByteArray {
    require(nonce.size == NONCE_SIZE)
    require(intent.revision >= 1L && intent.epoch >= 1L &&
      intent.epoch <= intent.revision &&
      intent.approvingSequence > 0L &&
      intent.approvingSequence < Long.MAX_VALUE)
    require(intent.approvingDevice != intent.candidateDevice)
    val domain = if (candidateSignature) possessionDomain else approvalDomain
    val oldKey = intent.approvingDevice.hex.chunked(2).map { it.toInt(16).toByte() }
    val newKey = intent.candidateDevice.hex.chunked(2).map { it.toInt(16).toByte() }
    return ByteArrayOutputStream().also { buffer ->
      DataOutputStream(buffer).use { out ->
        out.writeInt(domain.size)
        out.write(domain)
        out.writeInt(1)
        out.writeInt(oldKey.size)
        oldKey.forEach { out.writeByte(it.toInt()) }
        out.writeInt(newKey.size)
        newKey.forEach { out.writeByte(it.toInt()) }
        out.writeLong(intent.revision)
        out.writeLong(intent.epoch)
        out.writeLong(intent.approvingSequence)
        out.writeInt(nonce.size)
        out.write(nonce)
      }
    }.toByteArray()
  }

  private fun verifyEd25519(
    publicKey: PublicKey, payload: ByteArray, signature: ByteArray,
    labVerifierProvider: Provider?
  ): Boolean =
    try {
      val verifier = if (labVerifierProvider == null) Signature.getInstance("Ed25519")
        else Signature.getInstance("Ed25519", labVerifierProvider)
      verifier.initVerify(publicKey)
      verifier.update(payload)
      verifier.verify(signature)
    } catch (_: Exception) {
      false
    }

  /**
   * Never pass request-supplied keys as trusted keys in production.
   * "PROCEED" means ONLY that two public-key possession/approval proofs are
   * cryptographically consistent with the supplied synthetic registry.
   * Strong native owner authorization and durable trusted enrollment remain
   * separate mandatory steps.
   */
  fun inspect(
    registry: DeviceTrustSnapshot?,
    floor: DeviceTrustFloor?,
    intent: SyntheticDeviceEnrollmentIntent,
    alreadyApprovedDeviceKey: PublicKey?,
    candidateDeviceKey: PublicKey?,
    issuedChallenge: ByteArray?,
    returnedChallenge: ByteArray?,
    approvingSignature: ByteArray?,
    candidateSignature: ByteArray?,
    // Only disposable Android test fixtures may supply a JCA provider.
    // Production authorization must fix and audit its implementation.
    labVerifierProvider: Provider? = null
  ): SyntheticEnrollmentGate {
    if (registry == null || !SyntheticDeviceTrustPolicy.wellFormed(registry)) {
      return SyntheticEnrollmentGate.DENY_MALFORMED_REGISTRY
    }
    if (floor == null || floor.minRevision < 1L || floor.minEpoch < 1L ||
        registry.revision < floor.minRevision || registry.epoch < floor.minEpoch) {
      return SyntheticEnrollmentGate.DENY_UNTRUSTED_FLOOR
    }
    if (registry.revision != intent.revision || registry.epoch != intent.epoch) {
      return SyntheticEnrollmentGate.DENY_STALE_REGISTRY
    }
    if (intent.approvingDevice !in registry.active ||
        intent.approvingDevice in registry.revoked ||
        intent.approvingDevice == intent.candidateDevice) {
      return SyntheticEnrollmentGate.DENY_UNTRUSTED_APPROVER
    }
    if (intent.candidateDevice in registry.active ||
        intent.candidateDevice in registry.revoked) {
      return SyntheticEnrollmentGate.DENY_DUPLICATE_OR_REVOKED_CANDIDATE
    }
    val last = registry.lastSequence[intent.approvingDevice] ?: 0L
    if (intent.approvingSequence <= 0L ||
        intent.approvingSequence >= Long.MAX_VALUE ||
        intent.approvingSequence <= last) {
      return SyntheticEnrollmentGate.DENY_INVALID_SEQUENCE
    }
    if (issuedChallenge == null || returnedChallenge == null ||
        issuedChallenge.size != NONCE_SIZE || returnedChallenge.size != NONCE_SIZE ||
        !MessageDigest.isEqual(issuedChallenge, returnedChallenge)) {
      return SyntheticEnrollmentGate.DENY_INVALID_CHALLENGE
    }
    if (alreadyApprovedDeviceKey == null || candidateDeviceKey == null ||
        SyntheticSignedDeviceProofLab.fingerprint(alreadyApprovedDeviceKey) != intent.approvingDevice ||
        SyntheticSignedDeviceProofLab.fingerprint(candidateDeviceKey) != intent.candidateDevice) {
      return SyntheticEnrollmentGate.DENY_UNTRUSTED_PUBLIC_KEY
    }
    if (approvingSignature == null || approvingSignature.size != ED25519_SIGNATURE_SIZE ||
        !verifyEd25519(alreadyApprovedDeviceKey,
          payload(intent, returnedChallenge, false), approvingSignature.copyOf(), labVerifierProvider)) {
      return SyntheticEnrollmentGate.DENY_APPROVAL_SIGNATURE
    }
    if (candidateSignature == null || candidateSignature.size != ED25519_SIGNATURE_SIZE ||
        !verifyEd25519(candidateDeviceKey,
          payload(intent, returnedChallenge, true), candidateSignature.copyOf(), labVerifierProvider)) {
      return SyntheticEnrollmentGate.DENY_CANDIDATE_SIGNATURE
    }
    return SyntheticEnrollmentGate.PROCEED_TO_INDEPENDENT_PERSISTENT_ENROLLMENT_PROTOCOL
  }
}
