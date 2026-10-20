package com.negresco.finance.security

import java.util.concurrent.atomic.AtomicReference

/**
 * SEC-05, isolated device/session revocation and replay prototype.
 *
 * This source has NO device attestation, signature verification, secure
 * persistence, Keystore, network, production financial operations, or
 * Android/Expo integration. In particular, the Boolean "proofVerified"
 * below is a TEST-ONLY substitution for an independent cryptographic
 * authorizer. Never expose it to JavaScript, network or an AI model.
 */
internal enum class DeviceTrustGate {
  DENY_MALFORMED_STATE,
  DENY_UNTRUSTED_ANCHOR,
  DENY_UNKNOWN_DEVICE,
  DENY_REVOKED,
  DENY_STALE_EPOCH,
  DENY_STALE_REGISTRY_REVISION,
  DENY_REPLAY_OR_INVALID_SEQUENCE,
  DENY_EXTERNAL_PROOF_MISSING,
  DENY_INVALID_DEVICE_SIGNATURE,
  PROCEED_TO_INDEPENDENT_NATIVE_VERIFICATION,
  SYNTHETIC_SEQUENCE_RECORDED,
  SYNTHETIC_DEVICE_REVOKED
}

/** SHA-256 fingerprint of an independently verified public key, NOT an ID claim. */
internal data class DeviceKeyFingerprint private constructor(val hex: String) {
  companion object {
    fun parse(hex: String): DeviceKeyFingerprint {
      require(Regex("[0-9a-f]{64}").matches(hex)) {
        "Device key fingerprint must be exactly 32 bytes of lowercase hex"
      }
      return DeviceKeyFingerprint(hex)
    }
  }
}

/**
 * The snapshot is UNTRUSTED until validated against a secure, monotonic
 * revision/epoch anchor external to this laboratory.
 *
 * The maps/sets are immutable copies in transitions; no static account,
 * private key, device serial, location, customer identifier or credential.
 */
internal data class DeviceTrustSnapshot(
  val revision: Long,
  val epoch: Long,
  val active: Set<DeviceKeyFingerprint>,
  val revoked: Set<DeviceKeyFingerprint>,
  val lastSequence: Map<DeviceKeyFingerprint, Long>
)

internal data class DeviceTrustFloor(val minRevision: Long, val minEpoch: Long)

internal data class PresentedDeviceOperation(
  val fingerprint: DeviceKeyFingerprint,
  val registryRevision: Long,
  val epoch: Long,
  val sequence: Long,
  val operation: ProtectedOperation
)

/**
 * Positive preflight means only "continue to cryptographically verify the
 * signed, operation-bound device assertion". It is NOT an unlock.
 */
internal object SyntheticDeviceTrustPolicy {
  internal fun wellFormed(snapshot: DeviceTrustSnapshot): Boolean =
    snapshot.revision >= 1L && snapshot.epoch >= 1L &&
      snapshot.epoch <= snapshot.revision &&
      (snapshot.active.isNotEmpty() || snapshot.revoked.isNotEmpty()) &&
      snapshot.active.intersect(snapshot.revoked).isEmpty() &&
      snapshot.lastSequence.keys.all { it in snapshot.active } &&
      snapshot.lastSequence.values.all { it >= 0L }

  fun inspect(
    snapshot: DeviceTrustSnapshot?,
    floor: DeviceTrustFloor?,
    claim: PresentedDeviceOperation
  ): DeviceTrustGate {
    if (snapshot == null || !wellFormed(snapshot)) {
      return DeviceTrustGate.DENY_MALFORMED_STATE
    }
    if (floor == null || floor.minRevision < 0L || floor.minEpoch < 0L ||
        snapshot.revision < floor.minRevision || snapshot.epoch < floor.minEpoch) {
      return DeviceTrustGate.DENY_UNTRUSTED_ANCHOR
    }
    if (claim.fingerprint in snapshot.revoked) return DeviceTrustGate.DENY_REVOKED
    if (claim.fingerprint !in snapshot.active) return DeviceTrustGate.DENY_UNKNOWN_DEVICE
    if (claim.epoch != snapshot.epoch) return DeviceTrustGate.DENY_STALE_EPOCH
    if (claim.registryRevision != snapshot.revision) {
      return DeviceTrustGate.DENY_STALE_REGISTRY_REVISION
    }
    val last = snapshot.lastSequence[claim.fingerprint] ?: 0L
    if (claim.sequence <= 0L || claim.sequence == Long.MAX_VALUE || claim.sequence <= last) {
      return DeviceTrustGate.DENY_REPLAY_OR_INVALID_SEQUENCE
    }
    return DeviceTrustGate.PROCEED_TO_INDEPENDENT_NATIVE_VERIFICATION
  }

  /**
   * Explicit synthetic bootstrap, only after future enrollment is separately
   * proven. Not a production registration API and does not generate keys.
   */
  fun createSyntheticFirstDevice(fingerprint: DeviceKeyFingerprint) =
    DeviceTrustSnapshot(
      revision = 1L,
      epoch = 1L,
      active = setOf(fingerprint),
      revoked = emptySet(),
      lastSequence = mapOf(fingerprint to 0L)
    )
}

/**
 * Atomic CAS limits duplicate sequence reuse inside ONE JVM process.
 * It DOES NOT protect against process death, storage rollback or a replayed
 * snapshot. A future product requires durable transactional counters and
 * an independent monotonic anchor/protected backend.
 */
internal class SyntheticDeviceTrustCoordinator(initial: DeviceTrustSnapshot) {
  private fun immutableCopy(snapshot: DeviceTrustSnapshot) = snapshot.copy(
    active = snapshot.active.toSet(),
    revoked = snapshot.revoked.toSet(),
    lastSequence = snapshot.lastSequence.toMap()
  )

  // Prevent untrusted MutableSet/MutableMap callers from changing the state
  // underneath a CAS. Still NOT a secure or durable anti-rollback anchor.
  private val state = AtomicReference(immutableCopy(initial))

  fun snapshotForLabOnly(): DeviceTrustSnapshot = immutableCopy(state.get())

  fun preflight(claim: PresentedDeviceOperation, floor: DeviceTrustFloor?): DeviceTrustGate =
    SyntheticDeviceTrustPolicy.inspect(state.get(), floor, claim)

  /**
   * TEST ONLY. A true Boolean does not prove possession of a private key.
   * This operation records a sequence, NEVER returns a financial capability.
   */
  fun simulateRecordingAfterExternalProof(
    claim: PresentedDeviceOperation,
    floor: DeviceTrustFloor?,
    proofVerified: Boolean
  ): DeviceTrustGate {
    if (!proofVerified) return DeviceTrustGate.DENY_EXTERNAL_PROOF_MISSING
    return recordSequenceAfterTrustedVerification(claim, floor)
  }

  /**
   * Genuine Ed25519 verification for one SYNTHETIC claim, followed by an
   * atomic in-process sequence update. Trusted enrollment, challenge issue,
   * durable nonce consumption and revocation floor still do not exist here.
   *
   * The public key MUST originate from a trusted enrollment record,
   * NEVER a self-declared key from an incoming operation.
   */
  fun recordSignedSyntheticOperation(
    claim: PresentedDeviceOperation,
    floor: DeviceTrustFloor?,
    enrolledPublicKey: java.security.PublicKey?,
    independentlyIssuedNonce: ByteArray?,
    presentedNonce: ByteArray?,
    signature: ByteArray?
  ): DeviceTrustGate {
    if (!SyntheticSignedDeviceProofLab.verify(
        claim, enrolledPublicKey, independentlyIssuedNonce, presentedNonce, signature
      )) return DeviceTrustGate.DENY_INVALID_DEVICE_SIGNATURE
    return recordSequenceAfterTrustedVerification(claim, floor)
  }

  private fun recordSequenceAfterTrustedVerification(
    claim: PresentedDeviceOperation,
    floor: DeviceTrustFloor?
  ): DeviceTrustGate {
    while (true) {
      val current = state.get()
      val gate = SyntheticDeviceTrustPolicy.inspect(current, floor, claim)
      if (gate != DeviceTrustGate.PROCEED_TO_INDEPENDENT_NATIVE_VERIFICATION) return gate
      val updated = current.copy(
        lastSequence = current.lastSequence + (claim.fingerprint to claim.sequence)
      )
      if (state.compareAndSet(current, updated)) {
        return DeviceTrustGate.SYNTHETIC_SEQUENCE_RECORDED
      }
    }
  }

  /**
   * TEST ONLY. Future implementation must verify an authenticated,
   * operation-bound revocation and atomically persist BOTH counters/state.
   */
  fun simulateRevocationAfterExternalProof(
    fingerprint: DeviceKeyFingerprint,
    floor: DeviceTrustFloor?,
    proofVerified: Boolean
  ): DeviceTrustGate {
    if (!proofVerified) return DeviceTrustGate.DENY_EXTERNAL_PROOF_MISSING
    while (true) {
      val current = state.get()
      if (!SyntheticDeviceTrustPolicy.wellFormed(current)) {
        return DeviceTrustGate.DENY_MALFORMED_STATE
      }
      if (floor == null || floor.minRevision < 0L || floor.minEpoch < 0L ||
          current.revision < floor.minRevision || current.epoch < floor.minEpoch) {
        return DeviceTrustGate.DENY_UNTRUSTED_ANCHOR
      }
      if (fingerprint in current.revoked) return DeviceTrustGate.DENY_REVOKED
      if (fingerprint !in current.active) return DeviceTrustGate.DENY_UNKNOWN_DEVICE
      if (current.revision == Long.MAX_VALUE || current.epoch == Long.MAX_VALUE) {
        return DeviceTrustGate.DENY_MALFORMED_STATE
      }
      val updated = current.copy(
        revision = current.revision + 1L,
        epoch = current.epoch + 1L,
        active = current.active - fingerprint,
        revoked = current.revoked + fingerprint,
        lastSequence = current.lastSequence - fingerprint
      )
      // Fail closed when revoking the final device. No empty registry is
      // accepted for normal operations. Recovery has a separate ceremony.
      if (state.compareAndSet(current, updated)) {
        return DeviceTrustGate.SYNTHETIC_DEVICE_REVOKED
      }
    }
  }
}
