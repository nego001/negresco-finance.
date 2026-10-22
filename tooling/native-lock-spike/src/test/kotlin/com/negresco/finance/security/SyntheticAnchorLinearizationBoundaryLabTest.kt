package com.negresco.finance.security

import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * SEC-05K disposable test of read-then-act TOCTOU vs same-JVM monitor fencing.
 *
 * A Synchronized JVM monitor is NOT a hardware monotonic counter, a network
 * transaction, an owner grant or durable write. Even its successful return
 * is OBSERVATION ONLY and MUST NEVER release a financial journal.
 */
internal fun runSyntheticAnchorLinearizationBoundaryScenarios() {
  var checks = 0
  fun verify(ok: Boolean, label: String) {
    check(ok) { "SEC05K linearization boundary: $label" }
    checks++
  }
  val anchor = SyntheticProtectedAnchorFixtureLab()
  val pin = anchor.pinnedIdentityFixtureOnly
  val account = UUID.randomUUID().toString().replace("-", "")
  fun claim(version: Long, generation: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(
      account, kit, version, generation,
      MessageDigest.getInstance("SHA-256").digest(
        "sec05k-fenced-diagnostic-$account-$kit".toByteArray())
    )
  }
  val old = claim(9, 11)
  val current = claim(10, 12)
  val next = claim(11, 13)
  val advanceId = UUID.randomUUID()

  verify(anchor.enrollFixtureOnly(old) ==
    SyntheticAnchorCasResultLab.BOOTSTRAPPED_FIXTURE_ONLY,
    "random test account explicitly enrolled")
  verify(anchor.observeFixtureOnly(old, old, pin) ==
    SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
    "unfenced matching preflight is only a transient observation")
  verify(anchor.advanceFixtureOnly(advanceId, old, current, pin) ==
    SyntheticAnchorCasResultLab.ADVANCED_FIXTURE_ONLY,
    "a later CAS makes the previously correct preflight stale")
  var probes = 0
  verify(anchor.inspectWithinJvmFenceFixtureOnly(old, old, pin) { probes++ } ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "diagnostic critical section rechecks live floor rather than trusting preflight")
  verify(probes == 0, "stale local snapshot never invokes the diagnostic callback")
  verify(anchor.inspectWithinJvmFenceFixtureOnly(current, current, UUID.randomUUID()) {
    probes++
  } == SyntheticAnchorBoundaryObservationLab.DENY_WRONG_ANCHOR_PIN,
    "wrong pin refuses fenced inspection")
  verify(probes == 0, "incorrect pin never enters diagnostic callback")

  anchor.reachableFixtureOnly = false
  verify(anchor.inspectWithinJvmFenceFixtureOnly(current, current, pin) { probes++ } ==
    SyntheticAnchorBoundaryObservationLab.HOLD_ANCHOR_UNAVAILABLE,
    "offline anchor cannot fall back to prior matching preflight")
  verify(probes == 0, "offline anchor never invokes diagnostic callback")
  anchor.reachableFixtureOnly = true

  val pool = Executors.newFixedThreadPool(2)
  val insideProbe = CountDownLatch(1)
  val releaseProbe = CountDownLatch(1)
  val writerStarted = CountDownLatch(1)
  try {
    val reader = pool.submit<SyntheticAnchorBoundaryObservationLab> {
      anchor.inspectWithinJvmFenceFixtureOnly(current, current, pin) {
        insideProbe.countDown()
        check(releaseProbe.await(15L, TimeUnit.SECONDS)) {
          "diagnostic callback was not released"
        }
      }
    }
    verify(insideProbe.await(10L, TimeUnit.SECONDS),
      "fenced diagnostic callback entered with current floor")
    val writer = pool.submit<SyntheticAnchorCasResultLab> {
      writerStarted.countDown()
      anchor.advanceFixtureOnly(UUID.randomUUID(), current, next, pin)
    }
    verify(writerStarted.await(10L, TimeUnit.SECONDS),
      "competing writer attempted CAS while diagnostic probe held monitor")
    verify(!writer.isDone, "same-JVM CAS cannot finish before probe leaves monitor")
    releaseProbe.countDown()
    verify(reader.get(10L, TimeUnit.SECONDS) ==
      SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
      "monitor serialized in-process observation callback before CAS")
    verify(writer.get(10L, TimeUnit.SECONDS) ==
      SyntheticAnchorCasResultLab.ADVANCED_FIXTURE_ONLY,
      "later writer advances after callback exits")
    verify(anchor.inspectWithinJvmFenceFixtureOnly(current, current, pin) { probes++ } ==
      SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
      "previously matching observation is stale immediately after next commit")
    verify(anchor.inspectWithinJvmFenceFixtureOnly(next, next, pin) { probes++ } ==
      SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
      "newest generation matches but remains observation-only")
    verify(probes == 1, "diagnostic callback called only for matching newest generation")
  } finally {
    releaseProbe.countDown()
    pool.shutdownNow()
  }

  // A successful local probe is NOT a transaction fence across a remote
  // database, Android filesystem, or another JVM. A different service could
  // publish after the callback exits, so policy still requires external trust.
  val journal = SyntheticRekeyReconciliationInputLab(
    SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
    SyntheticRekeyJournalObservationLab.COMMITTED,
    SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
    SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED,
    SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
    true, old.version, current.version, old.generation, current.generation
  )
  verify(SyntheticJournalAuthorityReconciliationPolicyLab.decide(journal) ==
    SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
    "same-JVM monitor cannot promote any signed fixture to trusted external authority")

  println("PASS: SEC-05K $checks local linearization/TOCTOU boundary checks (fixture only)")
  println("LIMIT: JVM monitor never fences a PostgreSQL or Android commit across processes")
}
