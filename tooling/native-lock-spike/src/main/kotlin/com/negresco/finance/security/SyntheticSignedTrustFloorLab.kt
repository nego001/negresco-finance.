package com.negresco.finance.security

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import java.security.interfaces.EdECPublicKey

/**
 * SEC-05: verification of a fresh, externally signed anti-rollback witness.
 *
 * LAB ONLY. There is NO trusted issuer, pinned key provisioner, network,
 * account binding, durable server ledger, online freshness protocol or
 * Android Keystore integration in this repository. A public key received
 * FROM AN UNTRUSTED CALLER would make this entire protocol meaningless.
 *
 * A verified floor is merely a consistency check: it NEVER opens financial
 * data, grants permissions, registers a device or advances counters.
 */
internal data class SignedFloorClaim(
  val subject: DeviceKeyFingerprint,
  val revision: Long,
  val epoch: Long,
  val minLastSequence: Long
)

internal enum class SignedFloorCheck {
  DENY_MISSING_AUTHORITY,
  DENY_MALFORMED_FLOOR,
  DENY_CHALLENGE_MISMATCH,
  DENY_SIGNATURE,
  DENY_OTHER_DEVICE,
  DENY_ROLLED_BACK_REVISION,
  DENY_ROLLED_BACK_EPOCH,
  DENY_ROLLED_BACK_SEQUENCE,
  PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER
}

internal object SyntheticSignedTrustFloorLab {
  private val domain = "negresco.finance.authority-floor.ed25519.v1"
    .toByteArray(StandardCharsets.US_ASCII)
  private const val CHALLENGE_BYTES = 32
  private const val SIGNATURE_BYTES = 64

  private fun isEd25519(key: PublicKey): Boolean =
    key is EdECPublicKey && key.params.name == "Ed25519" &&
      key.format == "X.509" && key.encoded != null

  /**
   * Wire format independent of locale, JSON field order and JVM enum ordinal.
   * The challenge MUST be freshly generated and retained by a trusted client.
   * The authority MUST sign its CURRENT authoritative counters for that
   * challenge (not simply echo arbitrary counters supplied by the client).
   */
  fun payload(claim: SignedFloorClaim, challenge: ByteArray): ByteArray {
    require(challenge.size == CHALLENGE_BYTES) { "Invalid challenge length" }
    require(claim.revision >= 1L && claim.epoch >= 1L &&
      claim.epoch <= claim.revision && claim.minLastSequence >= 0L &&
      claim.minLastSequence != Long.MAX_VALUE) { "Invalid floor fields" }
    val subjectBytes = claim.subject.hex.chunked(2)
      .map { it.toInt(16).toByte() }.toByteArray()
    require(subjectBytes.size == 32)
    return ByteArrayOutputStream().also { buffer ->
      DataOutputStream(buffer).use { output ->
        output.writeInt(domain.size)
        output.write(domain)
        output.writeInt(1)
        output.writeInt(subjectBytes.size)
        output.write(subjectBytes)
        output.writeLong(claim.revision)
        output.writeLong(claim.epoch)
        output.writeLong(claim.minLastSequence)
        output.writeInt(challenge.size)
        output.write(challenge)
      }
    }.toByteArray()
  }

  /**
   * Only accept trustedAuthorityPublicKey when it was pinned/provisioned
   * through a separate, audited trust path. Neither JS nor remote payload
   * may choose the key that authenticates a floor.
   *
   * A signed floor cannot be considered current unless the trusted authority
   * itself enforces monotonic counters and answers the unique fresh challenge.
   * Offline replay/rollback still requires a different protected anchor.
   */
  fun inspect(
    local: SyntheticLedgerView?,
    floor: SignedFloorClaim?,
    trustedAuthorityPublicKey: PublicKey?,
    freshClientChallenge: ByteArray?,
    returnedChallenge: ByteArray?,
    authoritySignature: ByteArray?
  ): SignedFloorCheck {
    if (trustedAuthorityPublicKey == null || !isEd25519(trustedAuthorityPublicKey)) {
      return SignedFloorCheck.DENY_MISSING_AUTHORITY
    }
    if (local == null || floor == null || local.revision < 1L ||
        local.epoch < 1L || local.epoch > local.revision ||
        local.lastSequence < 0L || local.lastSequence == Long.MAX_VALUE ||
        floor.revision < 1L || floor.epoch < 1L ||
        floor.epoch > floor.revision || floor.minLastSequence < 0L ||
        floor.minLastSequence == Long.MAX_VALUE) {
      return SignedFloorCheck.DENY_MALFORMED_FLOOR
    }
    if (freshClientChallenge == null || returnedChallenge == null ||
        freshClientChallenge.size != CHALLENGE_BYTES ||
        returnedChallenge.size != CHALLENGE_BYTES ||
        !MessageDigest.isEqual(freshClientChallenge, returnedChallenge)) {
      return SignedFloorCheck.DENY_CHALLENGE_MISMATCH
    }
    if (authoritySignature == null || authoritySignature.size != SIGNATURE_BYTES) {
      return SignedFloorCheck.DENY_SIGNATURE
    }
    val signatureVerified = try {
      val verifier = Signature.getInstance("Ed25519")
      verifier.initVerify(trustedAuthorityPublicKey)
      verifier.update(payload(floor, returnedChallenge))
      verifier.verify(authoritySignature.copyOf())
    } catch (_: Exception) {
      false
    }
    if (!signatureVerified) return SignedFloorCheck.DENY_SIGNATURE
    if (floor.subject != local.fingerprint) return SignedFloorCheck.DENY_OTHER_DEVICE

    // Require an EXACT state version. A mismatched local/remote state must
    // enter a separate, authenticated reconciliation path, not self-heal.
    if (local.revision != floor.revision) {
      return SignedFloorCheck.DENY_ROLLED_BACK_REVISION
    }
    if (local.epoch != floor.epoch) return SignedFloorCheck.DENY_ROLLED_BACK_EPOCH
    if (local.lastSequence < floor.minLastSequence) {
      return SignedFloorCheck.DENY_ROLLED_BACK_SEQUENCE
    }
    return SignedFloorCheck.PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER
  }
}
