package com.negresco.finance.security

/**
 * SEC-05K — conservative reconciliation POLICY for a future, independently
 * authenticated CURRENT and monotonic generation authority.
 *
 * This is a PURE, disposable JVM policy lab. Inputs describing a "fresh"
 * authority response are trusted assertions of the TEST CALLER, NOT proof
 * verified here. The HMAC witness elsewhere in this repository is REPLAYABLE
 * and MUST NEVER be used to claim VERIFIED_LIVE_CURRENT.
 *
 * Does not read journal files, issue remote requests, commit transactions,
 * advance any counter, authorize an owner, or unlock financial records.
 */
internal enum class SyntheticRekeyAuthorityEvidenceLab {
  VERIFIED_LIVE_CURRENT, // only from a trusted, fresh and pinned verifier (NOT built yet)
  MISSING_OR_OFFLINE,
  REPLAYABLE_DETACHED_HMAC_ONLY,
  INVALID_OR_STALE
}
internal enum class SyntheticRekeyJournalObservationLab {
  CLEAN, PREPARED, COMMITTED, MISSING_OR_CORRUPT
}
internal enum class SyntheticRekeyCiphertextObservationLab {
  OLD_AUTHENTICATED, NEW_AUTHENTICATED, MISSING_OR_CORRUPT, UNRECOGNIZED
}
internal enum class SyntheticRekeyCandidateObservationLab {
  ABSENT, NEW_AUTHENTICATED, MISSING_OR_CORRUPT, UNRECOGNIZED
}
internal enum class SyntheticRekeyAuthorityGenerationLab {
  OLD_CURRENT, NEW_CURRENT, UNKNOWN_OR_OTHER
}
internal enum class SyntheticRekeyReconciliationDecisionLab {
  VERIFIED_STABLE_READ_ONLY,
  MAY_DISCARD_PREPARED_CANDIDATE_ONLY,
  MAY_FINALIZE_COMMITTED_NEW_SNAPSHOT_ONLY,
  MAY_CLEAR_COMMITTED_MARKER_ONLY,
  HOLD_EXTERNAL_AUTHORITY_REQUIRED,
  DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED,
  DENY_CORRUPT_OR_INCONSISTENT
}

internal data class SyntheticRekeyReconciliationInputLab(
  val authorityEvidence: SyntheticRekeyAuthorityEvidenceLab,
  val journal: SyntheticRekeyJournalObservationLab,
  val active: SyntheticRekeyCiphertextObservationLab,
  val pending: SyntheticRekeyCandidateObservationLab,
  val authorityGeneration: SyntheticRekeyAuthorityGenerationLab,
  val sameAccount: Boolean,
  val oldVersion: Long,
  val newVersion: Long,
  val oldGeneration: Long,
  val newGeneration: Long
)

internal object SyntheticJournalAuthorityReconciliationPolicyLab {
  fun decide(input: SyntheticRekeyReconciliationInputLab): SyntheticRekeyReconciliationDecisionLab {
    // Fail closed *before* considering local decisions. A detached HMAC
    // proves integrity of a receipt, NOT liveness, monotonicity, or authority.
    if (input.authorityEvidence != SyntheticRekeyAuthorityEvidenceLab.VERIFIED_LIVE_CURRENT)
      return SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED

    // Explicitly forbid local re-provision, silent version reset, overflow and
    // mismatched account or non-unit migration transitions.
    if (!input.sameAccount ||
        input.oldVersion < 1L || input.oldGeneration < 1L ||
        input.oldVersion == Long.MAX_VALUE || input.oldGeneration == Long.MAX_VALUE ||
        input.newVersion != input.oldVersion + 1L ||
        input.newGeneration != input.oldGeneration + 1L)
      return SyntheticRekeyReconciliationDecisionLab.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED

    if (input.journal == SyntheticRekeyJournalObservationLab.MISSING_OR_CORRUPT ||
        input.active == SyntheticRekeyCiphertextObservationLab.MISSING_OR_CORRUPT ||
        input.active == SyntheticRekeyCiphertextObservationLab.UNRECOGNIZED ||
        input.pending == SyntheticRekeyCandidateObservationLab.UNRECOGNIZED ||
        input.authorityGeneration == SyntheticRekeyAuthorityGenerationLab.UNKNOWN_OR_OTHER)
      return SyntheticRekeyReconciliationDecisionLab.DENY_CORRUPT_OR_INCONSISTENT

    return when (input.journal) {
      SyntheticRekeyJournalObservationLab.CLEAN ->
        if (input.pending == SyntheticRekeyCandidateObservationLab.ABSENT &&
          ((input.authorityGeneration == SyntheticRekeyAuthorityGenerationLab.OLD_CURRENT &&
            input.active == SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED) ||
            (input.authorityGeneration == SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT &&
              input.active == SyntheticRekeyCiphertextObservationLab.NEW_AUTHENTICATED)))
          SyntheticRekeyReconciliationDecisionLab.VERIFIED_STABLE_READ_ONLY
        else SyntheticRekeyReconciliationDecisionLab.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED

      SyntheticRekeyJournalObservationLab.PREPARED ->
        if (input.authorityGeneration == SyntheticRekeyAuthorityGenerationLab.OLD_CURRENT &&
            input.active == SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED)
          // Discard ONLY the uncommitted pending snapshot. No authority writes.
          SyntheticRekeyReconciliationDecisionLab.MAY_DISCARD_PREPARED_CANDIDATE_ONLY
        else SyntheticRekeyReconciliationDecisionLab.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED

      SyntheticRekeyJournalObservationLab.COMMITTED -> when {
        // An authority that already advanced to NEW allows a verified journal
        // to finish local promotion, but only if the exact NEW candidate is
        // available. This result is NOT executable authorization by itself.
        input.authorityGeneration == SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT &&
          input.active == SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED &&
          input.pending == SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED ->
          SyntheticRekeyReconciliationDecisionLab.MAY_FINALIZE_COMMITTED_NEW_SNAPSHOT_ONLY

        input.authorityGeneration == SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT &&
          input.active == SyntheticRekeyCiphertextObservationLab.NEW_AUTHENTICATED &&
          input.pending != SyntheticRekeyCandidateObservationLab.UNRECOGNIZED ->
          SyntheticRekeyReconciliationDecisionLab.MAY_CLEAR_COMMITTED_MARKER_ONLY

        // COMMITTED is a durable local decision. If authority is still OLD,
        // an operator/transaction protocol must reconcile first; do NOT
        // advance authority based solely on an unauthenticated local journal.
        input.authorityGeneration == SyntheticRekeyAuthorityGenerationLab.OLD_CURRENT ->
          SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED

        else -> SyntheticRekeyReconciliationDecisionLab.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED
      }

      SyntheticRekeyJournalObservationLab.MISSING_OR_CORRUPT ->
        SyntheticRekeyReconciliationDecisionLab.DENY_CORRUPT_OR_INCONSISTENT
    }
  }
}
