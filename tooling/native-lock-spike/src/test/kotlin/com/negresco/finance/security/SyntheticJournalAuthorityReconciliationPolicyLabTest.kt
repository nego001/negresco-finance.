package com.negresco.finance.security

import com.negresco.finance.security.SyntheticRekeyAuthorityEvidenceLab as E
import com.negresco.finance.security.SyntheticRekeyJournalObservationLab as J
import com.negresco.finance.security.SyntheticRekeyCiphertextObservationLab as A
import com.negresco.finance.security.SyntheticRekeyCandidateObservationLab as P
import com.negresco.finance.security.SyntheticRekeyAuthorityGenerationLab as G
import com.negresco.finance.security.SyntheticRekeyReconciliationDecisionLab as D

/** SEC-05K pure matrix: NO executable financial auth and no filesystem writes. */
internal fun runSyntheticJournalAuthorityReconciliationPolicyScenarios() {
  val policy = SyntheticJournalAuthorityReconciliationPolicyLab
  var checks = 0
  fun verify(actual: D, expected: D, reason: String) {
    check(actual == expected) { "SEC-05K recon: $reason, actual $actual expected $expected" }
    checks++
  }
  fun initial() = SyntheticRekeyReconciliationInputLab(
    E.VERIFIED_LIVE_CURRENT, J.CLEAN, A.OLD_AUTHENTICATED, P.ABSENT,
    G.OLD_CURRENT, true, 2L, 3L, 3L, 4L
  )
  val stableOld = initial()
  verify(policy.decide(stableOld), D.VERIFIED_STABLE_READ_ONLY,
    "exact old current generation is stable")
  verify(policy.decide(stableOld.copy(active = A.NEW_AUTHENTICATED,
      authorityGeneration = G.NEW_CURRENT)), D.VERIFIED_STABLE_READ_ONLY,
    "exact new current generation is stable")
  verify(policy.decide(stableOld.copy(journal = J.PREPARED,
      pending = P.NEW_AUTHENTICATED)), D.MAY_DISCARD_PREPARED_CANDIDATE_ONLY,
    "PREPARED with old authority may only roll back candidate")
  verify(policy.decide(stableOld.copy(journal = J.COMMITTED,
      pending = P.NEW_AUTHENTICATED, authorityGeneration = G.NEW_CURRENT)),
    D.MAY_FINALIZE_COMMITTED_NEW_SNAPSHOT_ONLY,
    "COMMITTED with trusted current new generation may finalize new candidate")
  verify(policy.decide(stableOld.copy(journal = J.COMMITTED,
      active = A.NEW_AUTHENTICATED, authorityGeneration = G.NEW_CURRENT)),
    D.MAY_CLEAR_COMMITTED_MARKER_ONLY,
    "COMMITTED with already-published authenticated NEW may clear marker")
  verify(policy.decide(stableOld.copy(journal = J.COMMITTED,
      active = A.NEW_AUTHENTICATED, pending = P.MISSING_OR_CORRUPT,
      authorityGeneration = G.NEW_CURRENT)),
    D.MAY_CLEAR_COMMITTED_MARKER_ONLY,
    "authenticated NEW active does not require obsolete leftover candidate")

  // Missing/untrusted/offline authority NEVER licenses automatic recovery,
  // including in previously optimistic PREPARED and COMMITTED cases.
  val safeCases = listOf(
    stableOld,
    stableOld.copy(journal = J.PREPARED, pending = P.NEW_AUTHENTICATED),
    stableOld.copy(journal = J.COMMITTED, pending = P.NEW_AUTHENTICATED,
      authorityGeneration = G.NEW_CURRENT),
    stableOld.copy(journal = J.COMMITTED,
      active = A.NEW_AUTHENTICATED, authorityGeneration = G.NEW_CURRENT)
  )
  for (evidence in listOf(E.MISSING_OR_OFFLINE, E.REPLAYABLE_DETACHED_HMAC_ONLY,
    E.INVALID_OR_STALE)) {
    for (case in safeCases) {
      verify(policy.decide(case.copy(authorityEvidence = evidence)),
        D.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
        "missing, stale or replayable HMAC authority never licenses a local action")
    }
  }

  val noAdvance = stableOld.copy(journal = J.COMMITTED,
    pending = P.NEW_AUTHENTICATED)
  verify(policy.decide(noAdvance), D.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
    "COMMITTED local with authority still OLD cannot auto-advance remote counter")
  verify(policy.decide(noAdvance.copy(active = A.NEW_AUTHENTICATED,
    pending = P.ABSENT)), D.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
    "already-published NEW with OLD authority also holds for protocol approval")
  verify(policy.decide(stableOld.copy(active = A.NEW_AUTHENTICATED)),
    D.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED,
    "clean local new ahead of authority old is never trusted")
  verify(policy.decide(stableOld.copy(authorityGeneration = G.NEW_CURRENT)),
    D.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED,
    "clean local old behind trusted authority new denies rollback")
  verify(policy.decide(stableOld.copy(journal = J.PREPARED,
    authorityGeneration = G.NEW_CURRENT, pending = P.NEW_AUTHENTICATED)),
    D.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED,
    "PREPARED journal cannot undo external authority advanced to NEW")
  verify(policy.decide(stableOld.copy(journal = J.PREPARED,
    active = A.NEW_AUTHENTICATED, authorityGeneration = G.NEW_CURRENT)),
    D.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED,
    "PREPARED with published NEW indicates an invalid state transition")
  verify(policy.decide(stableOld.copy(journal = J.COMMITTED,
    pending = P.MISSING_OR_CORRUPT, authorityGeneration = G.NEW_CURRENT)),
    D.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED,
    "COMMITTED old active with no new candidate cannot finalize")
  verify(policy.decide(stableOld.copy(journal = J.CLEAN,
    pending = P.NEW_AUTHENTICATED)),
    D.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED,
    "clean state carrying orphan candidate requires separate cleanup not authorization")

  for (journal in J.entries) {
    for (active in A.entries) {
      for (pending in P.entries) {
        for (generation in G.entries) {
          val case = stableOld.copy(journal = journal, active = active,
            pending = pending, authorityGeneration = generation)
          val result = policy.decide(case)
          val permitted = result in setOf(D.VERIFIED_STABLE_READ_ONLY,
            D.MAY_DISCARD_PREPARED_CANDIDATE_ONLY,
            D.MAY_FINALIZE_COMMITTED_NEW_SNAPSHOT_ONLY,
            D.MAY_CLEAR_COMMITTED_MARKER_ONLY)
          if (permitted) {
            check(journal != J.MISSING_OR_CORRUPT)
            check(active in setOf(A.OLD_AUTHENTICATED, A.NEW_AUTHENTICATED))
            check(generation != G.UNKNOWN_OR_OTHER)
            check(pending != P.UNRECOGNIZED)
          }
          if (journal == J.MISSING_OR_CORRUPT ||
              active == A.MISSING_OR_CORRUPT || active == A.UNRECOGNIZED ||
              pending == P.UNRECOGNIZED || generation == G.UNKNOWN_OR_OTHER) {
            verify(result, D.DENY_CORRUPT_OR_INCONSISTENT,
              "matrix cannot approve missing/corrupted journal, snapshot or witness state")
          } else checks++
        }
      }
    }
  }
  // Every externally mismatched account, invalid counter, overflow or
  // non-unit version/generation transition fails even on a clean state.
  val malformed = listOf(
    stableOld.copy(sameAccount = false),
    stableOld.copy(oldVersion = 0L),
    stableOld.copy(oldGeneration = 0L),
    stableOld.copy(oldVersion = Long.MAX_VALUE, newVersion = Long.MIN_VALUE),
    stableOld.copy(oldGeneration = Long.MAX_VALUE, newGeneration = Long.MIN_VALUE),
    stableOld.copy(newVersion = stableOld.oldVersion),
    stableOld.copy(newVersion = stableOld.oldVersion + 2L),
    stableOld.copy(newGeneration = stableOld.oldGeneration),
    stableOld.copy(newGeneration = stableOld.oldGeneration + 2L)
  )
  for (case in malformed)
    verify(policy.decide(case), D.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED,
      "invalid identity or monotonic step never authorizes change")

  println("PASS: SEC-05K $checks pure authority-reconciliation policy checks (no IO)")
}
