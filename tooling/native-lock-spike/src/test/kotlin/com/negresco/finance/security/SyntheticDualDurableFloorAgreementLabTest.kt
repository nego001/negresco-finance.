package com.negresco.finance.security

import java.nio.file.Files
import java.security.MessageDigest
import java.security.PublicKey
import java.security.SecureRandom
import java.util.UUID

/**
 * SEC-05K: TWO separate disposable child JVMs with their own persisted keys
 * and directories. BOTH directories are on the SAME CI host, so this is
 * neither a deployed multi-party authority nor independent secure hardware.
 *
 * Agreement of signatures from TWO fully replayable state files does NOT
 * confer freshness. All results are fixture-only and never authorize recovery.
 */
internal enum class SyntheticDualFloorDecisionFixtureLab {
  HOLD_MISSING_WITNESS_OR_PIN,
  HOLD_SAME_SIGNER,
  HOLD_NONCE_OR_SIGNATURE,
  HOLD_DIVERGENT_FLOORS,
  AGREEMENT_FIXTURE_ONLY_NOT_LIVE_AUTHORITY
}

internal data class SyntheticDualFloorQuoteFixtureLab(
  val nonce: ByteArray,
  val claim: SyntheticRekeyGenerationClaimLab,
  val signature: ByteArray
)

internal object SyntheticDualFloorAgreementPolicyFixtureLab {
  private val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  fun inspect(
    pinnedA: PublicKey?,
    pinnedB: PublicKey?,
    expectedNonceA: ByteArray,
    expectedNonceB: ByteArray,
    quoteA: SyntheticDualFloorQuoteFixtureLab?,
    quoteB: SyntheticDualFloorQuoteFixtureLab?
  ): SyntheticDualFloorDecisionFixtureLab {
    if (pinnedA == null || pinnedB == null || quoteA == null || quoteB == null ||
      !crypto.pinnedEd25519FixtureOnly(pinnedA) ||
      !crypto.pinnedEd25519FixtureOnly(pinnedB))
      return SyntheticDualFloorDecisionFixtureLab.HOLD_MISSING_WITNESS_OR_PIN
    if (MessageDigest.isEqual(pinnedA.encoded, pinnedB.encoded))
      return SyntheticDualFloorDecisionFixtureLab.HOLD_SAME_SIGNER
    if (expectedNonceA.size != crypto.CHALLENGE_SIZE ||
      expectedNonceB.size != crypto.CHALLENGE_SIZE ||
      MessageDigest.isEqual(expectedNonceA, expectedNonceB) ||
      !MessageDigest.isEqual(quoteA.nonce, expectedNonceA) ||
      !MessageDigest.isEqual(quoteB.nonce, expectedNonceB) ||
      !crypto.validClaimFixtureOnly(quoteA.claim) ||
      !crypto.validClaimFixtureOnly(quoteB.claim) ||
      !crypto.signatureValidFixtureOnly(
        pinnedA, quoteA.claim, expectedNonceA, quoteA.signature) ||
      !crypto.signatureValidFixtureOnly(
        pinnedB, quoteB.claim, expectedNonceB, quoteB.signature))
      return SyntheticDualFloorDecisionFixtureLab.HOLD_NONCE_OR_SIGNATURE
    if (!crypto.equivalentFixtureOnly(quoteA.claim, quoteB.claim))
      return SyntheticDualFloorDecisionFixtureLab.HOLD_DIVERGENT_FLOORS

    // Both signatures can be genuine and still describe an OLD generation:
    // an attacker can replay BOTH independent but ordinary state files.
    return SyntheticDualFloorDecisionFixtureLab.AGREEMENT_FIXTURE_ONLY_NOT_LIVE_AUTHORITY
  }
}

internal fun runSyntheticDualDurableFloorAgreementScenarios() {
  val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  val rand = SecureRandom()
  var checks = 0
  fun verify(ok: Boolean, reason: String) {
    check(ok) { "SEC05K two-floor fixture: " + reason }
    checks++
  }
  fun nonce(): ByteArray = ByteArray(crypto.CHALLENGE_SIZE).also { rand.nextBytes(it) }
  fun claim(account: String, v: Long, g: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    val hash = MessageDigest.getInstance("SHA-256")
      .digest(("disposable-dual-witness-" + account + "-" + kit).toByteArray())
    return SyntheticRekeyGenerationClaimLab(account, kit, v, g, hash)
  }
  fun observe(
    floor: SyntheticDurableFloorClientFixtureLab,
    challenge: ByteArray
  ): SyntheticDualFloorQuoteFixtureLab? {
    val signed = floor.signedCurrent(challenge) ?: return null
    return SyntheticDualFloorQuoteFixtureLab(challenge.copyOf(), signed.first, signed.second)
  }
  fun inspect(
    a: SyntheticDurableFloorClientFixtureLab,
    b: SyntheticDurableFloorClientFixtureLab,
    pinnedA: PublicKey = a.childPublicKey,
    pinnedB: PublicKey = b.childPublicKey
  ): SyntheticDualFloorDecisionFixtureLab {
    val aNonce = nonce()
    val bNonce = nonce()
    return SyntheticDualFloorAgreementPolicyFixtureLab.inspect(
      pinnedA, pinnedB, aNonce, bNonce,
      observe(a, aNonce), observe(b, bNonce))
  }

  val account = UUID.randomUUID().toString().replace("-", "")
  val old = claim(account, 17, 21)
  val latest = claim(account, 18, 22)
  val rootA = Files.createTempDirectory("sec05k-dual-floor-a-")
  val rootB = Files.createTempDirectory("sec05k-dual-floor-b-")
  lateinit var pinnedA: PublicKey
  lateinit var pinnedB: PublicKey
  lateinit var oldBytesA: ByteArray
  lateinit var oldBytesB: ByteArray
  val policy = SyntheticDualFloorAgreementPolicyFixtureLab
  val hold = SyntheticDualFloorDecisionFixtureLab
  // Names below are intentionally verbose: NO branch is a production grant.
  SyntheticDurableFloorClientFixtureLab(rootA).use { a ->
    SyntheticDurableFloorClientFixtureLab(rootB).use { b ->
      pinnedA = a.childPublicKey
      pinnedB = b.childPublicKey
      verify(!MessageDigest.isEqual(pinnedA.encoded, pinnedB.encoded),
        "two child processes generated different signing keys")
      verify(inspect(a, b) == hold.HOLD_MISSING_WITNESS_OR_PIN,
        "no signature is not implicit enrollment")
      verify(a.enroll(old) == "OK_ENROLLED" && b.enroll(old) == "OK_ENROLLED",
        "two separate disposable roots provision OLD")
      oldBytesA = Files.readAllBytes(rootA.resolve("authority.state"))
      oldBytesB = Files.readAllBytes(rootB.resolve("authority.state"))
      verify(inspect(a, b) == hold.AGREEMENT_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
        "both OLD signatures agree, but do not prove current generation")
      verify(a.advance(old, latest) == "OK_ADVANCED",
        "A advances without B")
      verify(inspect(a, b) == hold.HOLD_DIVERGENT_FLOORS,
        "partial advance A=NEW B=OLD holds instead of choosing either")
      verify(b.advance(old, latest) == "OK_ADVANCED",
        "B explicitly advances only from its own OLD")
      verify(inspect(a, b) == hold.AGREEMENT_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
        "both NEW signatures agree, still NOT a trusted live authority")
      verify(a.advance(old, latest) == "DENY_PREDECESSOR" &&
        b.advance(old, latest) == "DENY_PREDECESSOR",
        "two witnesses reject stale predecessor")

      val x = nonce()
      val y = nonce()
      val qa = observe(a, x)!!
      val qb = observe(b, y)!!
      val accepted = hold.AGREEMENT_FIXTURE_ONLY_NOT_LIVE_AUTHORITY
      verify(policy.inspect(pinnedA, pinnedB, x, y, qa, qb) == accepted,
        "two independently challenged and signed fixture claims agree")
      verify(policy.inspect(null, pinnedB, x, y, qa, qb) ==
        hold.HOLD_MISSING_WITNESS_OR_PIN, "missing key pin fails closed")
      verify(policy.inspect(pinnedA, pinnedA, x, y, qa, qb) ==
        hold.HOLD_SAME_SIGNER, "same Ed25519 signer cannot count as two")
      verify(policy.inspect(pinnedB, pinnedA, x, y, qa, qb) ==
        hold.HOLD_NONCE_OR_SIGNATURE, "swapped signer key pins fail")
      verify(policy.inspect(pinnedA, pinnedB, x, x, qa, qb) ==
        hold.HOLD_NONCE_OR_SIGNATURE, "same challenge on both channels is rejected")
      verify(policy.inspect(pinnedA, pinnedB, ByteArray(2), y, qa, qb) ==
        hold.HOLD_NONCE_OR_SIGNATURE, "malformed challenge length is rejected")
      verify(policy.inspect(pinnedA, pinnedB, y, x, qa, qb) ==
        hold.HOLD_NONCE_OR_SIGNATURE, "swapped expected nonces are rejected")
      verify(policy.inspect(pinnedA, pinnedB, x, y,
        qa.copy(signature = qa.signature.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() }),
        qb) == hold.HOLD_NONCE_OR_SIGNATURE, "forged signature fails")
      verify(policy.inspect(pinnedA, pinnedB, x, y,
        qa.copy(claim = old), qb) == hold.HOLD_NONCE_OR_SIGNATURE,
        "replacing a signed claim without signing anew fails")
      verify(policy.inspect(pinnedA, pinnedB, x, y, qa, null) ==
        hold.HOLD_MISSING_WITNESS_OR_PIN, "offline B holds all decisions")
      verify(policy.inspect(pinnedA, pinnedB, x, y,
        qa.copy(nonce = y), qb) == hold.HOLD_NONCE_OR_SIGNATURE,
        "unexpected returned nonce cannot validate")

      // A signed quote from BEFORE the next advance does not become invalid
      // retroactively. Reusing it here illustrates stale-read/TOCTOU risk.
      verify(policy.inspect(pinnedA, pinnedB, x, y, qa, qb) == accepted,
        "critical limit: previously signed pair stays valid if locally replayed")
    }
  }

  SyntheticDurableFloorClientFixtureLab(rootA).use { a ->
    SyntheticDurableFloorClientFixtureLab(rootB).use { b ->
      verify(MessageDigest.isEqual(pinnedA.encoded, a.childPublicKey.encoded) &&
        MessageDigest.isEqual(pinnedB.encoded, b.childPublicKey.encoded),
        "restarting both JVMs retains their originally pinned fixture keys")
      verify(inspect(a, b, pinnedA, pinnedB) ==
        hold.AGREEMENT_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
        "two durable files retain NEW across process restarts")
    }
  }

  // Restore A only while B remains NEW. No PostgreSQL or mobile data touched.
  Files.write(rootA.resolve("authority.state"), oldBytesA)
  SyntheticDurableFloorClientFixtureLab(rootA).use { a ->
    SyntheticDurableFloorClientFixtureLab(rootB).use { b ->
      verify(inspect(a, b, pinnedA, pinnedB) == hold.HOLD_DIVERGENT_FLOORS,
        "single-authority restore causes signed divergence")
      verify(a.enroll(old) == "DENY_ALREADY_ENROLLED",
        "rewound A does not pretend to be an unprovisioned authority")
    }
  }

  // Critical limitation: attacker can restore BOTH state files and their
  // original private keys. The original public pins remain unchanged.
  Files.write(rootB.resolve("authority.state"), oldBytesB)
  SyntheticDurableFloorClientFixtureLab(rootA).use { a ->
    SyntheticDurableFloorClientFixtureLab(rootB).use { b ->
      verify(inspect(a, b, pinnedA, pinnedB) ==
        hold.AGREEMENT_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
        "CRITICAL LIMIT: paired file restore produces valid OLD agreement")
      val aNonce = nonce()
      val bNonce = nonce()
      val ra = observe(a, aNonce)!!
      val rb = observe(b, bNonce)!!
      verify(crypto.equivalentFixtureOnly(ra.claim, old) &&
        crypto.equivalentFixtureOnly(rb.claim, old),
        "both original pinned keys can now sign OLD again")
      verify(policy.inspect(pinnedA, pinnedB, aNonce, bNonce, ra, rb) ==
        hold.AGREEMENT_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
        "fresh nonces still cannot discover erased histories")
    }
  }
  // A paired signature from ordinary disks is NEVER authoritative evidence.
  val input = SyntheticRekeyReconciliationInputLab(
    SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
    SyntheticRekeyJournalObservationLab.CLEAN,
    SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
    SyntheticRekeyCandidateObservationLab.ABSENT,
    SyntheticRekeyAuthorityGenerationLab.OLD_CURRENT,
    true, old.version, latest.version, old.generation, latest.generation
  )
  verify(SyntheticJournalAuthorityReconciliationPolicyLab.decide(input) ==
    SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
    "no two-signer fixture may turn into VERIFIED_LIVE_CURRENT or journal permission")

  println("PASS: SEC-05K " + checks +
    " dual persisted-JVM witness comparison checks (same CI host, fixture only)")
  println("LIMIT: coordinated replay of both witness state files defeats signed agreement")
}
