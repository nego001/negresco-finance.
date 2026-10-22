package com.negresco.finance.security

import java.security.MessageDigest
import java.util.UUID

/**
 * SEC-05K NEGATIVE JDBC integration: no atomic commit spans a PostgreSQL
 * transaction and the VOLATILE test anchor in RAM.
 * Randomly scoped throwaway accounts only. No SQLCipher, owner auth, deployed
 * service, network authority, real secrets, automatic recovery or real grant.
 */
internal fun runSyntheticJdbcCrossDomainCommitOrderScenarios() {
  val pg = SyntheticJdbcRekeyCasPersistenceLab()
  val anchor = SyntheticProtectedAnchorFixtureLab()
  val pin = anchor.pinnedIdentityFixtureOnly
  val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  var checks = 0
  fun verify(ok: Boolean, reason: String) {
    check(ok) { "SEC05K cross-domain ordering: $reason" }
    checks++
  }
  fun account(): String = UUID.randomUUID().toString().replace("-", "")
  fun claim(a: String, v: Long, g: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(a, kit, v, g,
      MessageDigest.getInstance("SHA-256")
        .digest(("sec05k-order-disposable-" + a + "-" + kit).toByteArray()))
  }
  fun observation(a: String, expected: SyntheticRekeyGenerationClaimLab) =
    anchor.observeFixtureOnly(pg.currentFixtureOnly(a)!!, expected, pin)
  fun journalHolds(old: SyntheticRekeyGenerationClaimLab,
                   newer: SyntheticRekeyGenerationClaimLab) =
    SyntheticJournalAuthorityReconciliationPolicyLab.decide(
      SyntheticRekeyReconciliationInputLab(
        SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
        SyntheticRekeyJournalObservationLab.COMMITTED,
        SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
        SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED,
        SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
        true, old.version, newer.version, old.generation, newer.generation
      )) == SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED

  // ORDER A: RAM anchor CAS succeeds but reply disappears. SQL is still OLD.
  val a = account()
  val aOld = claim(a, 7, 9)
  val aNew = claim(a, 8, 10)
  val aOther = claim(a, 8, 10)
  val aOp = UUID.randomUUID()
  verify(pg.bootstrapFixtureOnly(aOld) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "A: random disposable SQL account enrolled")
  verify(anchor.enrollFixtureOnly(aOld) == SyntheticAnchorCasResultLab.BOOTSTRAPPED_FIXTURE_ONLY,
    "A: independent volatile anchor enrolled")
  verify(anchor.advanceFixtureOnly(aOp, aOld, aNew, pin, dropReplyAfterCommit = true) ==
    SyntheticAnchorCasResultLab.LOST_REPLY_AFTER_ADVANCE,
    "A: authority advance lost its ACK before SQL commit")
  verify(crypto.equivalentFixtureOnly(pg.currentFixtureOnly(a)!!, aOld) &&
    pg.receiptsFixtureOnly(a) == 0,
    "A: SQL remains OLD without operation receipt")
  verify(observation(a, aOld) ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "A: RAM NEW and PostgreSQL OLD disagree")
  verify(anchor.advanceFixtureOnly(aOp, aOld, aNew, pin) ==
    SyntheticAnchorCasResultLab.ALREADY_APPLIED_FIXTURE_ONLY,
    "A: exact retry only verifies previous RAM operation")
  verify(anchor.advanceFixtureOnly(aOp, aOld, aOther, pin) ==
    SyntheticAnchorCasResultLab.DENY_COLLISION,
    "A: anchor operation ID binds exact kit and ciphertext hash")

  // Same operation ID committed into SQL with a conflicting candidate.
  // Identical version/generation numbers DO NOT imply compatible receipts.
  verify(pg.compareAndSwapFixtureOnly(aOp, aOld, aOther) == "ADVANCED_FIXTURE_ONLY",
    "A: SQL can commit a DIFFERENT candidate under the same UUID")
  val aReceipt = pg.persistedOperationFixtureOnly(a, aOp)
  verify(aReceipt != null && crypto.equivalentFixtureOnly(aReceipt.first, aOld) &&
    crypto.equivalentFixtureOnly(aReceipt.second, aOther),
    "A: durable SQL receipt binds conflicting payload")
  verify(observation(a, aNew) ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "A: equal counters but distinct kit and hash fail closed")
  verify(pg.compareAndSwapFixtureOnly(aOp, aOld, aNew) ==
    "DENY_IDEMPOTENCY_COLLISION",
    "A: SQL refuses anchor payload after conflicting receipt")
  verify(anchor.advanceFixtureOnly(aOp, aOld, aOther, pin) ==
    SyntheticAnchorCasResultLab.DENY_COLLISION,
    "A: anchor refuses SQL payload after conflicting receipt")
  verify(journalHolds(aOld, aNew),
    "A: no recovery from conflicting receipts without real authority")

  // ORDER B: SQL succeeds, drops ACK, and the external anchor is OFFLINE.
  val b = account()
  val bOld = claim(b, 15, 19)
  val bNew = claim(b, 16, 20)
  val bOther = claim(b, 16, 20)
  val bOp = UUID.randomUUID()
  verify(pg.bootstrapFixtureOnly(bOld) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "B: second disposable SQL account enrolled")
  verify(anchor.enrollFixtureOnly(bOld) == SyntheticAnchorCasResultLab.BOOTSTRAPPED_FIXTURE_ONLY,
    "B: second isolated RAM anchor account enrolled")
  verify(pg.compareAndSwapFixtureOnly(bOp, bOld, bNew, loseResponseAfterCommit = true) == null,
    "B: SQL commits before losing ACK")
  verify(pg.receiptsFixtureOnly(b) == 1 &&
    crypto.equivalentFixtureOnly(pg.currentFixtureOnly(b)!!, bNew),
    "B: SQL persists NEW and receipt in same transaction")
  anchor.reachableFixtureOnly = false
  verify(anchor.advanceFixtureOnly(bOp, bOld, bNew, pin) ==
    SyntheticAnchorCasResultLab.HOLD_OFFLINE,
    "B: offline anchor prevents automatic fallback")
  verify(observation(b, bOld) ==
    SyntheticAnchorBoundaryObservationLab.HOLD_ANCHOR_UNAVAILABLE,
    "B: a missing anchor never licenses use of SQL receipt")
  anchor.reachableFixtureOnly = true
  verify(observation(b, bOld) ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "B: SQL NEW disagrees with anchor OLD after reconnect")
  verify(pg.compareAndSwapFixtureOnly(bOp, bOld, bNew) ==
    "ALREADY_APPLIED_CURRENT_FIXTURE_ONLY",
    "B: SQL retry is idempotent but cannot advance anchor")
  verify(anchor.advanceFixtureOnly(bOp, bOld, bOther, pin) ==
    SyntheticAnchorCasResultLab.ADVANCED_FIXTURE_ONLY,
    "B: separate RAM CAS can commit conflicting NEW")
  verify(observation(b, bNew) ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "B: two successful receipts disagree on ciphertext")
  verify(anchor.advanceFixtureOnly(bOp, bOld, bNew, pin) ==
    SyntheticAnchorCasResultLab.DENY_COLLISION,
    "B: anchor refuses conflicting SQL operation payload")
  verify(pg.compareAndSwapFixtureOnly(bOp, bOld, bOther) ==
    "DENY_IDEMPOTENCY_COLLISION",
    "B: SQL refuses conflicting anchor operation payload")
  verify(journalHolds(bOld, bNew),
    "B: missing common transaction requires HOLD, no compensation")

  // ORDER C: matching results after sequential commits are not evidence
  // that any common atomic/linearizable distributed commit occurred.
  val c = account()
  val cOld = claim(c, 3, 4)
  val cNew = claim(c, 4, 5)
  val cOp = UUID.randomUUID()
  verify(pg.bootstrapFixtureOnly(cOld) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "C: third disposable SQL account enrolled")
  verify(anchor.enrollFixtureOnly(cOld) == SyntheticAnchorCasResultLab.BOOTSTRAPPED_FIXTURE_ONLY,
    "C: third RAM account enrolled")
  verify(pg.compareAndSwapFixtureOnly(cOp, cOld, cNew) == "ADVANCED_FIXTURE_ONLY",
    "C: SQL advances before RAM anchor")
  verify(observation(c, cOld) ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "C: intermediate split remains visible")
  verify(anchor.advanceFixtureOnly(cOp, cOld, cNew, pin) ==
    SyntheticAnchorCasResultLab.ADVANCED_FIXTURE_ONLY,
    "C: separate explicit anchor CAS eventually matches SQL")
  verify(observation(c, cNew) ==
    SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
    "C: matched generations still cannot prove distributed atomic commit")
  verify(pg.receiptsFixtureOnly(c) == 1 && journalHolds(cOld, cNew),
    "C: matching final receipts cannot authorize local journal")
  println("PASS: SEC-05K $checks PostgreSQL/anchor commit ordering checks (fixture only)")
  println("LIMIT: SQL and VOLATILE RAM anchor have no shared trusted linearizable commit")
}
