package com.negresco.finance.security

import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * SEC-05K disposable PostgreSQL/JVM integration NEGATIVE TEST.
 *
 * A monitor on the simulated anchor does NOT lock a PostgreSQL transaction,
 * nor does the result authorize financial data/journal publication. Tests run
 * only against the existing randomly scoped negresco_sec05k_cas_lab schema.
 */
internal fun runSyntheticJdbcLocalFenceDoesNotFencePgScenarios() {
  val pg = SyntheticJdbcRekeyCasPersistenceLab()
  val anchor = SyntheticProtectedAnchorFixtureLab()
  val pin = anchor.pinnedIdentityFixtureOnly
  val account = UUID.randomUUID().toString().replace("-", "")
  fun claim(version: Long, generation: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(account, kit, version, generation,
      MessageDigest.getInstance("SHA-256").digest(
        "sec05k-jdbc-not-fenced-disposable-$account-$kit".toByteArray()))
  }
  val old = claim(21, 22)
  val newer = claim(22, 23)
  var checks = 0
  fun verify(ok: Boolean, reason: String) {
    check(ok) { "SEC05K PG-fence negative: $reason" }
    checks++
  }
  verify(pg.bootstrapFixtureOnly(old) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "isolated random PostgreSQL test account enrolled")
  verify(anchor.enrollFixtureOnly(old) ==
    SyntheticAnchorCasResultLab.BOOTSTRAPPED_FIXTURE_ONLY,
    "unrelated volatile JVM anchor provisioned")
  val diagnosticEntered = CountDownLatch(1)
  val releaseDiagnostic = CountDownLatch(1)
  val pool = Executors.newFixedThreadPool(2)
  try {
    val diagnostic = pool.submit<SyntheticAnchorBoundaryObservationLab> {
      anchor.inspectWithinJvmFenceFixtureOnly(old, old, pin) {
        diagnosticEntered.countDown()
        check(releaseDiagnostic.await(40, TimeUnit.SECONDS)) {
          "timed out releasing disposable diagnostic"
        }
      }
    }
    verify(diagnosticEntered.await(15, TimeUnit.SECONDS),
      "diagnostic starts while anchor monitor is held")
    val committed = pool.submit<String?> {
      pg.compareAndSwapFixtureOnly(UUID.randomUUID(), old, newer)
    }
    verify(committed.get(30, TimeUnit.SECONDS) == "ADVANCED_FIXTURE_ONLY",
      "CRITICAL NEGATIVE: PostgreSQL CAS commits WHILE JVM anchor monitor is held")
    val databaseNow = pg.currentFixtureOnly(account)
    verify(databaseNow != null &&
      SyntheticSignedRekeyAuthorityChallengeLab.equivalentFixtureOnly(databaseNow, newer),
      "a second SQL session observes NEW before anchor diagnostic exits")
    verify(!diagnostic.isDone,
      "local JVM callback is still inside critical section after SQL commit")
    releaseDiagnostic.countDown()
    verify(diagnostic.get(15, TimeUnit.SECONDS) ==
      SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
      "CRITICAL NEGATIVE: local monitor reports OLD while PostgreSQL has already committed NEW")
  } finally {
    releaseDiagnostic.countDown()
    pool.shutdownNow()
  }

  verify(anchor.observeFixtureOnly(pg.currentFixtureOnly(account)!!, old, pin) ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "subsequent cross-store read detects disagreement but cannot undo SQL CAS")
  verify(anchor.advanceFixtureOnly(UUID.randomUUID(), old, newer, pin) ==
    SyntheticAnchorCasResultLab.ADVANCED_FIXTURE_ONLY,
    "separate anchor CAS can catch up only by a distinct test action")
  verify(anchor.observeFixtureOnly(pg.currentFixtureOnly(account)!!, newer, pin) ==
    SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
    "agreement following separate commits still does not prove atomic distributed commit")
  val suspectJournal = SyntheticRekeyReconciliationInputLab(
    SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
    SyntheticRekeyJournalObservationLab.COMMITTED,
    SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
    SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED,
    SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
    true, old.version, newer.version, old.generation, newer.generation
  )
  verify(SyntheticJournalAuthorityReconciliationPolicyLab.decide(suspectJournal) ==
    SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
    "isolated local monitor is never authorization for journal publication")
  println("PASS: SEC-05K $checks PostgreSQL CAS outside local JVM monitor checks (fixture only)")
  println("LIMIT: no distributed transaction, verified owner, durable anchor or production authority")
}
