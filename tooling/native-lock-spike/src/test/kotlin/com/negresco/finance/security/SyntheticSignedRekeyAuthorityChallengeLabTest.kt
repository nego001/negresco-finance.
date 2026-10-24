package com.negresco.finance.security

import java.nio.charset.StandardCharsets
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import java.util.UUID
import com.negresco.finance.security.SyntheticSignedRekeyChallengeCheckLab as C

/** All signatures/keys/challenges are newly generated in memory, not credentials. */
internal fun runSyntheticSignedRekeyAuthorityChallengeScenarios() {
  var checks = 0
  fun verify(actual: C, expected: C, why: String) {
    check(actual == expected) { "SEC-05K signed generation: $why, actual=$actual expected=$expected" }
    checks++
  }
  fun assertThat(condition: Boolean, why: String) {
    check(condition) { "SEC-05K signed generation: $why" }
    checks++
  }
  val signer = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val stranger = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val sessionExpected = SyntheticRekeyGenerationClaimLab(
    "7a".repeat(16), UUID.randomUUID().toString(), 3, 4,
    MessageDigest.getInstance("SHA-256").digest("disposable encrypted bytes"
      .toByteArray(StandardCharsets.UTF_8))
  )
  fun copyClaim(
    account: String = sessionExpected.accountId,
    kit: String = sessionExpected.kitId,
    version: Long = sessionExpected.version,
    generation: Long = sessionExpected.generation,
    digest: ByteArray = sessionExpected.ciphertextHash
  ) = SyntheticRekeyGenerationClaimLab(account, kit, version, generation, digest)
  fun newSession(
    expected: SyntheticRekeyGenerationClaimLab = sessionExpected,
    key: PublicKey? = signer.public
  ) = SyntheticSignedRekeyChallengeSessionLab(expected, key)
  fun signature(
    keys: KeyPair, claim: SyntheticRekeyGenerationClaimLab,
    challenge: ByteArray
  ): ByteArray {
    val signing = Signature.getInstance("Ed25519")
    signing.initSign(keys.private)
    signing.update(SyntheticSignedRekeyAuthorityChallengeLab.payloadFixtureOnly(claim, challenge))
    return signing.sign()
  }

  run {
    val session = newSession()
    val challenge = session.issueChallengeFixtureOnly()!!
    assertThat(challenge.size == 32, "session issues 256-bit challenge")
    verify(session.verifyOnceFixtureOnly(challenge, sessionExpected,
      signature(signer, sessionExpected, challenge)),
      C.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "valid pinned-key Ed25519 signature is only fixture proof")
    verify(session.verifyOnceFixtureOnly(challenge, sessionExpected,
      signature(signer, sessionExpected, challenge)),
      C.DENY_REUSED_OR_EXPIRED_SESSION,
      "challenge cannot be verified twice in same session")
    assertThat(session.issueChallengeFixtureOnly() == null,
      "consumed client session no longer issues challenge")
  }
  run {
    val old = newSession()
    val first = old.issueChallengeFixtureOnly()!!
    val signedOld = signature(signer, sessionExpected, first)
    val current = newSession()
    val second = current.issueChallengeFixtureOnly()!!
    assertThat(!MessageDigest.isEqual(first, second),
      "independent sessions use distinct random challenges")
    verify(current.verifyOnceFixtureOnly(second, sessionExpected, signedOld),
      C.DENY_SIGNATURE, "signature replay using new challenge is rejected")
  }
  run {
    val current = newSession()
    val live = current.issueChallengeFixtureOnly()!!
    val previous = newSession().issueChallengeFixtureOnly()!!
    verify(current.verifyOnceFixtureOnly(previous, sessionExpected,
      signature(signer, sessionExpected, previous)),
      C.DENY_CHALLENGE_MISMATCH,
      "nonce from different session cannot satisfy fresh challenge")
    verify(current.verifyOnceFixtureOnly(live, sessionExpected,
      signature(signer, sessionExpected, live)),
      C.DENY_REUSED_OR_EXPIRED_SESSION,
      "failed challenge attempt consumes nonce too")
  }
  val mutated = listOf(
    "other account" to copyClaim(account = "33".repeat(16)),
    "other kit" to copyClaim(kit = UUID.randomUUID().toString()),
    "older version" to copyClaim(version = 2),
    "newer generation" to copyClaim(generation = 5),
    "different ciphertext digest" to copyClaim(digest = ByteArray(32) { 4 })
  )
  for ((reason, claim) in mutated) {
    val session = newSession()
    val nonce = session.issueChallengeFixtureOnly()!!
    verify(session.verifyOnceFixtureOnly(nonce, claim, signature(signer, claim, nonce)),
      C.DENY_CLAIM_MISMATCH,
      "signed response bound to wrong $reason is rejected")
  }
  run {
    val session = newSession()
    val nonce = session.issueChallengeFixtureOnly()!!
    val tampered = signature(signer, sessionExpected, nonce)
    tampered[5] = (tampered[5].toInt() xor 1).toByte()
    verify(session.verifyOnceFixtureOnly(nonce, sessionExpected, tampered),
      C.DENY_SIGNATURE, "one-bit signature alteration fails")
  }
  run {
    val session = newSession()
    val nonce = session.issueChallengeFixtureOnly()!!
    verify(session.verifyOnceFixtureOnly(nonce, sessionExpected,
      signature(stranger, sessionExpected, nonce)),
      C.DENY_SIGNATURE, "valid signature from unpinned signer fails")
  }
  run {
    val session = newSession()
    val nonce = session.issueChallengeFixtureOnly()!!
    verify(session.verifyOnceFixtureOnly(nonce, sessionExpected, ByteArray(3)),
      C.DENY_SIGNATURE, "signature with wrong length fails")
  }
  run {
    val session = newSession()
    verify(session.verifyOnceFixtureOnly(byteArrayOf(1, 2), sessionExpected, ByteArray(64)),
      C.DENY_CHALLENGE_MISMATCH, "truncated client challenge fails")
  }
  run {
    val session = newSession()
    val nonce = session.issueChallengeFixtureOnly()!!
    verify(session.verifyOnceFixtureOnly(nonce, sessionExpected, null),
      C.DENY_SIGNATURE, "missing signature fails")
  }
  run {
    val session = newSession()
    val nonce = session.issueChallengeFixtureOnly()!!
    verify(session.verifyOnceFixtureOnly(nonce, null, null),
      C.DENY_MALFORMED_CLAIM, "missing signed claim fails")
  }
  run {
    val session = newSession()
    val nonce = session.issueChallengeFixtureOnly()!!
    verify(session.verifyOnceFixtureOnly(nonce,
      copyClaim(digest = ByteArray(3)), null),
      C.DENY_MALFORMED_CLAIM, "malformed ciphertext digest fails")
  }
  run {
    val session = newSession(copyClaim(version = 0))
    val nonce = session.issueChallengeFixtureOnly()!!
    verify(session.verifyOnceFixtureOnly(nonce, sessionExpected,
      signature(signer, sessionExpected, nonce)),
      C.DENY_MALFORMED_CLAIM, "invalid target generation claim fails")
  }
  run {
    val session = newSession(key = null)
    val nonce = session.issueChallengeFixtureOnly()!!
    verify(session.verifyOnceFixtureOnly(nonce, sessionExpected,
      signature(signer, sessionExpected, nonce)),
      C.DENY_MISSING_PINNED_AUTHORITY, "no pinned authority key fails")
  }
  run {
    val ec = KeyPairGenerator.getInstance("EC").also { it.initialize(256) }.generateKeyPair()
    val session = newSession(key = ec.public)
    val nonce = session.issueChallengeFixtureOnly()!!
    verify(session.verifyOnceFixtureOnly(nonce, sessionExpected,
      signature(signer, sessionExpected, nonce)),
      C.DENY_MISSING_PINNED_AUTHORITY, "P-256 key cannot masquerade as Ed25519")
  }
  run {
    val a = copyClaim()
    val c = ByteArray(32) { 12 }
    val x = SyntheticSignedRekeyAuthorityChallengeLab.payloadFixtureOnly(a, c)
    val y = SyntheticSignedRekeyAuthorityChallengeLab.payloadFixtureOnly(a, c)
    assertThat(x.contentEquals(y), "canonical payload is deterministic")
    val changed = SyntheticSignedRekeyAuthorityChallengeLab.payloadFixtureOnly(
      copyClaim(generation = a.generation + 1), c)
    assertThat(!x.contentEquals(changed),
      "generation mutation changes signed canonical payload")
    val changedChallenge = SyntheticSignedRekeyAuthorityChallengeLab.payloadFixtureOnly(
      a, ByteArray(32) { 13 })
    assertThat(!x.contentEquals(changedChallenge),
      "challenge mutation changes signed canonical payload")
  }
  println("PASS: SEC-05K $checks challenge-bound Ed25519 signature checks (no live authority)")
}
