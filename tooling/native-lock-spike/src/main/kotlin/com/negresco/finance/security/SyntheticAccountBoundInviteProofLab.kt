package com.negresco.finance.security

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import java.util.UUID

/**
 * SEC-05C: canonical account + invitation + device bound Ed25519 proof.
 *
 * Portable JVM laboratory ONLY. Account ID and approved public key are
 * fixtures, NOT authenticated sessions or provisioned server state.
 * Verifying these bytes never grants enrollment, unlock or financial access.
 */
internal enum class SyntheticBoundInviteProofCheck {
  DENY_INVALID_BINDING,
  DENY_NONCE,
  DENY_UNTRUSTED_KEY,
  DENY_APPROVER_SIGNATURE,
  DENY_CANDIDATE_SIGNATURE,
  PROOF_VERIFIED_ONLY
}

internal object SyntheticAccountBoundInviteProofLab {
  private val accountPattern = Regex("[0-9a-f]{32}")
  private val invitationPattern =
    Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
  private val approvingDomain =
    "negresco.finance.account-invite.approver.ed25519.v1".toByteArray(StandardCharsets.US_ASCII)
  private val candidateDomain =
    "negresco.finance.account-invite.candidate.ed25519.v1".toByteArray(StandardCharsets.US_ASCII)

  private fun hexBytes(hex: String): ByteArray =
    hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

  private fun wellFormed(
    accountId: String, invitationId: String, intent: SyntheticDeviceEnrollmentIntent
  ): Boolean =
    accountPattern.matches(accountId) && invitationPattern.matches(invitationId) &&
      intent.approvingDevice != intent.candidateDevice &&
      intent.revision >= 1L && intent.epoch >= 1L && intent.epoch <= intent.revision &&
      intent.approvingSequence in 1L until Long.MAX_VALUE

  /**
   * Binary, length-prefixed, role-separated version 1 wire format.
   * A signature cannot be transferred to a different account, invitation,
   * candidate/approver, revision, epoch, sequence or nonce.
   */
  fun payload(
    accountId: String,
    invitationId: String,
    intent: SyntheticDeviceEnrollmentIntent,
    nonce: ByteArray,
    candidateRole: Boolean
  ): ByteArray {
    require(wellFormed(accountId, invitationId, intent)) { "Invalid account invitation binding" }
    require(nonce.size == 32) { "Invalid invitation nonce" }
    val domain = if (candidateRole) candidateDomain else approvingDomain
    val uuid = UUID.fromString(invitationId)
    return ByteArrayOutputStream().also { buffer ->
      DataOutputStream(buffer).use { output ->
        output.writeInt(domain.size)
        output.write(domain)
        output.writeInt(1)
        output.writeInt(16)
        output.write(hexBytes(accountId))
        output.writeLong(uuid.mostSignificantBits)
        output.writeLong(uuid.leastSignificantBits)
        output.writeInt(32)
        output.write(hexBytes(intent.approvingDevice.hex))
        output.writeInt(32)
        output.write(hexBytes(intent.candidateDevice.hex))
        output.writeLong(intent.revision)
        output.writeLong(intent.epoch)
        output.writeLong(intent.approvingSequence)
        output.writeInt(nonce.size)
        output.write(nonce)
      }
    }.toByteArray()
  }

  fun inspect(
    accountId: String,
    invitationId: String,
    intent: SyntheticDeviceEnrollmentIntent,
    trustedApproverKey: PublicKey?,
    candidateKey: PublicKey?,
    issuedNonce: ByteArray?,
    receivedNonce: ByteArray?,
    approverSignature: ByteArray?,
    candidateSignature: ByteArray?
  ): SyntheticBoundInviteProofCheck {
    if (!wellFormed(accountId, invitationId, intent))
      return SyntheticBoundInviteProofCheck.DENY_INVALID_BINDING
    if (issuedNonce == null || receivedNonce == null ||
        issuedNonce.size != 32 || receivedNonce.size != 32 ||
        !MessageDigest.isEqual(issuedNonce, receivedNonce))
      return SyntheticBoundInviteProofCheck.DENY_NONCE
    if (trustedApproverKey == null || candidateKey == null ||
        SyntheticSignedDeviceProofLab.fingerprint(trustedApproverKey) != intent.approvingDevice ||
        SyntheticSignedDeviceProofLab.fingerprint(candidateKey) != intent.candidateDevice)
      return SyntheticBoundInviteProofCheck.DENY_UNTRUSTED_KEY
    if (!verify(trustedApproverKey, accountId, invitationId, intent, receivedNonce,
        false, approverSignature))
      return SyntheticBoundInviteProofCheck.DENY_APPROVER_SIGNATURE
    if (!verify(candidateKey, accountId, invitationId, intent, receivedNonce,
        true, candidateSignature))
      return SyntheticBoundInviteProofCheck.DENY_CANDIDATE_SIGNATURE
    return SyntheticBoundInviteProofCheck.PROOF_VERIFIED_ONLY
  }

  private fun verify(
    key: PublicKey, accountId: String, invitationId: String,
    intent: SyntheticDeviceEnrollmentIntent, nonce: ByteArray,
    candidateRole: Boolean, signature: ByteArray?
  ): Boolean {
    if (signature == null || signature.size != 64) return false
    return try {
      val verifier = Signature.getInstance("Ed25519")
      verifier.initVerify(key)
      verifier.update(payload(accountId, invitationId, intent, nonce, candidateRole))
      verifier.verify(signature.copyOf())
    } catch (_: Exception) {
      false
    }
  }
}
