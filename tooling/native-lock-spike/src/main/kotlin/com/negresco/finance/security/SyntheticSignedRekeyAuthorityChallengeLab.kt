package com.negresco.finance.security

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.PublicKey
import java.security.SecureRandom
import java.security.Signature
import java.util.UUID

/**
 * SEC-05K: detached Ed25519 challenge/response VERIFIER, disposable JVM only.
 *
 * The public key MUST be pinned independently by a trusted client. Neither a
 * network service nor a durable monotonic generation ledger exists here.
 * Even a valid challenge-bound signature is NOT proof the issuer's source of
 * truth is current. Never convert the result to VERIFIED_LIVE_CURRENT.
 *
 * No secrets, passwords, financial transactions, owner grants or database IO.
 */
internal class SyntheticRekeyGenerationClaimLab(
  val accountId: String,
  val kitId: String,
  val version: Long,
  val generation: Long,
  ciphertextSha256: ByteArray
) {
  val ciphertextHash: ByteArray = ciphertextSha256.copyOf()
}

internal enum class SyntheticSignedRekeyChallengeCheckLab {
  VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
  DENY_MISSING_PINNED_AUTHORITY,
  DENY_MALFORMED_CLAIM,
  DENY_CHALLENGE_MISMATCH,
  DENY_CLAIM_MISMATCH,
  DENY_SIGNATURE,
  DENY_REUSED_OR_EXPIRED_SESSION
}

internal object SyntheticSignedRekeyAuthorityChallengeLab {
  private val domain = "negresco.finance.sec05k.rekey.authority.ed25519.v1"
    .toByteArray(StandardCharsets.US_ASCII)
  const val CHALLENGE_SIZE = 32
  private const val SIGNATURE_SIZE = 64

  private fun valid(claim: SyntheticRekeyGenerationClaimLab): Boolean =
    Regex("[0-9a-f]{32}").matches(claim.accountId) &&
      runCatching { UUID.fromString(claim.kitId).toString() == claim.kitId }
        .getOrDefault(false) &&
      claim.version > 0 && claim.generation > 0 &&
      claim.version != Long.MAX_VALUE && claim.generation != Long.MAX_VALUE &&
      claim.ciphertextHash.size == 32

  fun payloadFixtureOnly(
    claim: SyntheticRekeyGenerationClaimLab, freshChallenge: ByteArray
  ): ByteArray {
    require(valid(claim) && freshChallenge.size == CHALLENGE_SIZE)
    val accountBytes = claim.accountId.chunked(2)
      .map { it.toInt(16).toByte() }.toByteArray()
    val kit = UUID.fromString(claim.kitId)
    return ByteArrayOutputStream().also { sink ->
      DataOutputStream(sink).use { out ->
        out.writeInt(domain.size)
        out.write(domain)
        out.writeInt(1)
        out.write(accountBytes)
        out.writeLong(kit.mostSignificantBits)
        out.writeLong(kit.leastSignificantBits)
        out.writeLong(claim.version)
        out.writeLong(claim.generation)
        out.write(claim.ciphertextHash)
        out.write(freshChallenge)
      }
    }.toByteArray()
  }

  internal fun validClaimFixtureOnly(claim: SyntheticRekeyGenerationClaimLab): Boolean =
    valid(claim)

  internal fun equivalentFixtureOnly(
    a: SyntheticRekeyGenerationClaimLab, b: SyntheticRekeyGenerationClaimLab
  ): Boolean = a.accountId == b.accountId && a.kitId == b.kitId &&
    a.version == b.version && a.generation == b.generation &&
    MessageDigest.isEqual(a.ciphertextHash, b.ciphertextHash)

  internal fun pinnedEd25519FixtureOnly(key: PublicKey?): Boolean =
    key != null && SyntheticSignedDeviceProofLab.fingerprint(key) != null

  internal fun signatureValidFixtureOnly(
    pinnedKey: PublicKey, claim: SyntheticRekeyGenerationClaimLab,
    challenge: ByteArray, signatureBytes: ByteArray
  ): Boolean {
    if (signatureBytes.size != SIGNATURE_SIZE) return false
    return try {
      val verifier = Signature.getInstance("Ed25519")
      verifier.initVerify(pinnedKey)
      verifier.update(payloadFixtureOnly(claim, challenge))
      verifier.verify(signatureBytes.copyOf())
    } catch (_: Exception) { false }
  }
}

/**
 * A client-generated random nonce is consumed for ANY verification attempt.
 * A second check (even with a valid response) is always rejected in this JVM.
 * The nonce state is volatile: a real client needs protected session storage,
 * proper key provisioning, and a live authority response protocol.
 */
internal class SyntheticSignedRekeyChallengeSessionLab(
  private val expected: SyntheticRekeyGenerationClaimLab,
  private val pinnedAuthorityKey: PublicKey?,
  random: SecureRandom = SecureRandom()
) {
  private val challenge = ByteArray(SyntheticSignedRekeyAuthorityChallengeLab.CHALLENGE_SIZE)
    .also { random.nextBytes(it) }
  private var used = false

  @Synchronized
  fun issueChallengeFixtureOnly(): ByteArray? =
    if (used) null else challenge.copyOf()

  @Synchronized
  fun verifyOnceFixtureOnly(
    returnedChallenge: ByteArray?,
    signedClaim: SyntheticRekeyGenerationClaimLab?,
    signature: ByteArray?
  ): SyntheticSignedRekeyChallengeCheckLab {
    val C = SyntheticSignedRekeyChallengeCheckLab
    val verifier = SyntheticSignedRekeyAuthorityChallengeLab
    if (used) return C.DENY_REUSED_OR_EXPIRED_SESSION
    used = true

    if (!verifier.pinnedEd25519FixtureOnly(pinnedAuthorityKey))
      return C.DENY_MISSING_PINNED_AUTHORITY
    if (signedClaim == null || !verifier.validClaimFixtureOnly(signedClaim) ||
        !verifier.validClaimFixtureOnly(expected))
      return C.DENY_MALFORMED_CLAIM
    if (returnedChallenge == null ||
        returnedChallenge.size != challenge.size ||
        !MessageDigest.isEqual(challenge, returnedChallenge))
      return C.DENY_CHALLENGE_MISMATCH
    if (!verifier.equivalentFixtureOnly(expected, signedClaim))
      return C.DENY_CLAIM_MISMATCH
    if (signature == null || !verifier.signatureValidFixtureOnly(
        pinnedAuthorityKey!!, signedClaim, returnedChallenge, signature))
      return C.DENY_SIGNATURE

    // Explicitly NOT a monotonic external authority assertion. This alone
    // cannot be used to authorize recovery or local journal mutation.
    return C.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY
  }
}
