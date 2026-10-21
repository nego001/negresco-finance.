package com.negresco.finance.security

import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Disposable JVM-only CAS / response-loss / signed-read protocol rehearsal. */
internal fun runSyntheticRekeyAuthorityCasTimeoutScenarios() {
  var checks = 0
  fun expect(condition: Boolean, reason: String) {
    check(condition) { "SEC-05K CAS: $reason" }
    checks++
  }
  fun expectOutcome(
    actual: SyntheticRekeyCasReceiptLab?,
    expected: SyntheticRekeyCasOutcomeLab,
    reason: String
  ) = expect(actual?.outcome == expected, reason)
  val keys = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  fun claim(
    account: String = "7a".repeat(16),
    kit: String = UUID.randomUUID().toString(),
    version: Long = 2L,
    generation: Long = 3L,
    hash: ByteArray = MessageDigest.getInstance("SHA-256")
      .digest("synthetic encrypted snapshot".toByteArray())
  ) = SyntheticRekeyGenerationClaimLab(account, kit, version, generation, hash)

  run {
    val authority = SyntheticRekeyAuthorityCasTimeoutLab(keys)
    val old = claim()
    val next = claim(kit = UUID.randomUUID().toString(), version = 3L, generation = 4L)
    val latest = claim(kit = UUID.randomUUID().toString(), version = 4L, generation = 5L)
    val op = UUID.randomUUID()
    expectOutcome(authority.bootstrapFixtureOnly(old),
      SyntheticRekeyCasOutcomeLab.BOOTSTRAPPED_FIXTURE_ONLY, "explicit bootstrap")
    expectOutcome(authority.bootstrapFixtureOnly(old),
      SyntheticRekeyCasOutcomeLab.DENY_STALE_OR_CONFLICTING_GENERATION,
      "re-bootstrap refuses resetting identity")
    expect(authority.compareAndSwapFixtureOnly(op, old, next,
      loseResponseAfterCommit = true) == null,
      "server CAS advances but network reply disappears")

    val session = SyntheticSignedRekeyChallengeSessionLab(next, keys.public)
    val nonce = session.issueChallengeFixtureOnly()!!
    val current = authority.signedCurrentFixtureOnly(old.accountId, nonce)!!
    expect(SyntheticSignedRekeyAuthorityChallengeLab.equivalentFixtureOnly(current.claim, next),
      "fresh signed read reports newer generation after lost reply")
    expect(session.verifyOnceFixtureOnly(current.returnedChallenge,
      current.claim, current.signature) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "new-challenge signed response matches pinned fixture signer and hash")
    expect(session.verifyOnceFixtureOnly(current.returnedChallenge,
      current.claim, current.signature) ==
      SyntheticSignedRekeyChallengeCheckLab.DENY_REUSED_OR_EXPIRED_SESSION,
      "same challenge response cannot be reused")
    val observed = SyntheticRekeyReconciliationInputLab(
      SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
      SyntheticRekeyJournalObservationLab.COMMITTED,
      SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
      SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED,
      SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
      true, 2L, 3L, 3L, 4L
    )
    expect(SyntheticJournalAuthorityReconciliationPolicyLab.decide(observed) ==
      SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
      "fixture signature cannot authorize journal promotion")
    expectOutcome(authority.compareAndSwapFixtureOnly(op, old, next),
      SyntheticRekeyCasOutcomeLab.ALREADY_APPLIED_CURRENT_FIXTURE_ONLY,
      "retry same id and payload does not advance twice")
    expectOutcome(authority.compareAndSwapFixtureOnly(op, old, latest),
      SyntheticRekeyCasOutcomeLab.DENY_INVALID_TRANSITION,
      "invalid multi-step reuse refused before op-id evaluation")
    val differentAfter = claim(kit = UUID.randomUUID().toString(),
      version = 3L, generation = 4L)
    expectOutcome(authority.compareAndSwapFixtureOnly(op, old, differentAfter),
      SyntheticRekeyCasOutcomeLab.DENY_CONFLICTING_OPERATION_ID,
      "same id reused with different valid payload is rejected")
    expectOutcome(authority.compareAndSwapFixtureOnly(UUID.randomUUID(), old, next),
      SyntheticRekeyCasOutcomeLab.DENY_STALE_OR_CONFLICTING_GENERATION,
      "fresh id cannot advance already advanced generation")
    expectOutcome(authority.compareAndSwapFixtureOnly(UUID.randomUUID(), next, latest),
      SyntheticRekeyCasOutcomeLab.ADVANCED_FIXTURE_ONLY,
      "valid subsequent migration advances one step")
    expectOutcome(authority.compareAndSwapFixtureOnly(op, old, next),
      SyntheticRekeyCasOutcomeLab.DENY_STALE_OR_CONFLICTING_GENERATION,
      "old successful op id is NOT evidence that old reply remains current")
    val finalSession = SyntheticSignedRekeyChallengeSessionLab(latest, keys.public)
    val finalNonce = finalSession.issueChallengeFixtureOnly()!!
    val signedFinal = authority.signedCurrentFixtureOnly(old.accountId, finalNonce)!!
    expect(finalSession.verifyOnceFixtureOnly(signedFinal.returnedChallenge,
      signedFinal.claim, signedFinal.signature) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "signed reads follow current in-memory generation after two advances")
  }

  run {
    val authority = SyntheticRekeyAuthorityCasTimeoutLab(keys)
    val old = claim()
    val next = claim(kit = UUID.randomUUID().toString(), version = 3L, generation = 4L)
    expectOutcome(authority.compareAndSwapFixtureOnly(UUID.randomUUID(), old, next),
      SyntheticRekeyCasOutcomeLab.DENY_MISSING_ACCOUNT,
      "unknown account cannot auto-bootstrap on CAS")
    expect(authority.signedCurrentFixtureOnly(old.accountId, ByteArray(32)) == null,
      "unknown account has no signed current response")
    expectOutcome(authority.bootstrapFixtureOnly(old),
      SyntheticRekeyCasOutcomeLab.BOOTSTRAPPED_FIXTURE_ONLY, "known account fixture started")
    expectOutcome(authority.compareAndSwapFixtureOnly(UUID.randomUUID(), old,
      claim(kit = old.kitId, version = 3L, generation = 4L)),
      SyntheticRekeyCasOutcomeLab.DENY_INVALID_TRANSITION,
      "CAS cannot keep previous kit")
    expectOutcome(authority.compareAndSwapFixtureOnly(UUID.randomUUID(), old,
      claim(kit = next.kitId, version = 4L, generation = 5L)),
      SyntheticRekeyCasOutcomeLab.DENY_INVALID_TRANSITION,
      "CAS cannot skip a generation")
    expectOutcome(authority.compareAndSwapFixtureOnly(UUID.randomUUID(),
      claim(kit = old.kitId, hash = ByteArray(32) { 7 }), next),
      SyntheticRekeyCasOutcomeLab.DENY_STALE_OR_CONFLICTING_GENERATION,
      "CAS compares previous ciphertext digest, not only counters")
    expectOutcome(authority.compareAndSwapFixtureOnly(UUID.randomUUID(), old,
      claim(account = "33".repeat(16), kit = next.kitId,
        version = 3L, generation = 4L)),
      SyntheticRekeyCasOutcomeLab.DENY_INVALID_TRANSITION,
      "cross-account generation advancement refused")
    expectOutcome(authority.compareAndSwapFixtureOnly(UUID.randomUUID(),
      claim(kit = old.kitId, version = Long.MAX_VALUE - 1,
        generation = Long.MAX_VALUE - 1),
      claim(kit = next.kitId, version = Long.MAX_VALUE,
        generation = Long.MAX_VALUE)),
      SyntheticRekeyCasOutcomeLab.DENY_INVALID_TRANSITION,
      "overflow and reserved max counter values refused")
    expect(authority.signedCurrentFixtureOnly(old.accountId, byteArrayOf(1)) == null,
      "short client challenge cannot receive signed reply")
    val challenger = SyntheticSignedRekeyChallengeSessionLab(next, keys.public)
    val nonce = challenger.issueChallengeFixtureOnly()!!
    val oldAnswer = authority.signedCurrentFixtureOnly(old.accountId, nonce)!!
    expect(challenger.verifyOnceFixtureOnly(oldAnswer.returnedChallenge,
      oldAnswer.claim, oldAnswer.signature) ==
      SyntheticSignedRekeyChallengeCheckLab.DENY_CLAIM_MISMATCH,
      "read returning OLD does not satisfy client's expected NEW")
  }

  // Two independent requests for the same predecessor cannot both win,
  // even if they race on different worker threads inside this one JVM.
  run {
    val authority = SyntheticRekeyAuthorityCasTimeoutLab(keys)
    val old = claim()
    val a = claim(kit = UUID.randomUUID().toString(), version = 3L, generation = 4L)
    val b = claim(kit = UUID.randomUUID().toString(), version = 3L, generation = 4L)
    authority.bootstrapFixtureOnly(old)
    val start = CountDownLatch(1)
    val pool = Executors.newFixedThreadPool(2)
    try {
      val first = pool.submit<SyntheticRekeyCasOutcomeLab> {
        start.await()
        authority.compareAndSwapFixtureOnly(UUID.randomUUID(), old, a)!!.outcome
      }
      val second = pool.submit<SyntheticRekeyCasOutcomeLab> {
        start.await()
        authority.compareAndSwapFixtureOnly(UUID.randomUUID(), old, b)!!.outcome
      }
      start.countDown()
      val outcomes = listOf(first.get(15L, TimeUnit.SECONDS),
        second.get(15L, TimeUnit.SECONDS))
      expect(outcomes.count {
        it == SyntheticRekeyCasOutcomeLab.ADVANCED_FIXTURE_ONLY
      } == 1, "only one concurrent compare-and-swap advances generation")
      expect(outcomes.count {
        it == SyntheticRekeyCasOutcomeLab.DENY_STALE_OR_CONFLICTING_GENERATION
      } == 1, "second concurrent writer sees stale predecessor")
    } finally { pool.shutdownNow() }
  }

  println("PASS: SEC-05K $checks in-memory CAS and lost-reply protocol checks (not a backend)")
}
