package com.negresco.finance.security

/**
 * Phase 1: PURE, NON-AUTHORITATIVE interruption and restore classifier.
 *
 * These step names are synthetic planning markers, NOT a durable on-device
 * journal, and inputs are untrusted claims. No I/O, writes, login, rollback
 * recovery, database or key operation is implemented.
 *
 * Results can ONLY be HOLD_* or DENY_*. In particular, a "completed" marker
 * or a syntactically valid DataStore snapshot never grants a session.
 */
internal object NativeLockMigrationInterruptionGate {
  private val steps = setOf(
    "NOT_STARTED",
    "INTENT_RECORDED",
    "SOURCE_BACKED_UP",
    "NATIVE_STAGED",
    "SOURCE_RETIRE_REQUESTED",
    "FINALIZED_UNVERIFIED"
  )
  private val targetExistsSteps = setOf(
    "NATIVE_STAGED", "SOURCE_RETIRE_REQUESTED", "FINALIZED_UNVERIFIED"
  )

  fun inspect(
    lastStep: String?,
    durableIntentClaim: String?,
    sourceStillPresent: Boolean,
    nativePresence: String,
    nativeRecord: String?,
    lifecycleCurrent: Boolean
  ): String {
    if (lastStep !in steps) return "DENY_UNKNOWN_MIGRATION_STEP"
    if (durableIntentClaim !in setOf(null, "pending", "finalizing", "completed"))
      return "DENY_UNKNOWN_JOURNAL"
    if (!lifecycleCurrent) return "HOLD_LIFECYCLE_REVOKED"
    if (nativePresence !in setOf("ABSENT", "PRESENT_UNVERIFIED"))
      return "DENY_NATIVE_STORAGE_UNSAFE"

    if (lastStep == "NOT_STARTED") {
      if (durableIntentClaim != null || nativePresence != "ABSENT" || nativeRecord != null)
        return "DENY_UNEXPECTED_MIGRATION_ARTIFACT"
      return "HOLD_OWNER_AUTH_REQUIRED"
    }

    // A missing durable intent after migration started could mean a rollback.
    if (durableIntentClaim == null) return "DENY_DURABLE_INTENT_MISSING"
    if (durableIntentClaim == "completed" && lastStep != "FINALIZED_UNVERIFIED")
      return "DENY_PREMATURE_COMPLETION_CLAIM"

    val expectTarget = lastStep in targetExistsSteps
    if (expectTarget && nativePresence != "PRESENT_UNVERIFIED")
      return "DENY_TARGET_MISSING_OR_RESTORED"
    if (!expectTarget && (nativePresence != "ABSENT" || nativeRecord != null))
      return "DENY_TARGET_PREMATURE_OR_REPLAYED"
    if (expectTarget && nativeRecord != "VALID_UNTRUSTED")
      return "DENY_TARGET_RECORD_UNVERIFIED"

    // Losing the only source before the final synthetic stage is irrecoverable
    // without independently verified backup, which this gate does NOT possess.
    if (!sourceStillPresent && lastStep != "FINALIZED_UNVERIFIED")
      return "DENY_SOURCE_LOST_BEFORE_VERIFIED_COMMIT"
    if (lastStep == "FINALIZED_UNVERIFIED" && durableIntentClaim != "completed")
      return "HOLD_FINALIZATION_INCOMPLETE"

    return when (lastStep) {
      "INTENT_RECORDED" -> "HOLD_RESUME_REQUIRES_OWNER_AUTH"
      "SOURCE_BACKED_UP" -> "HOLD_BACKUP_PROOF_REQUIRED"
      "NATIVE_STAGED" -> "HOLD_STAGED_NOT_AUTHENTICATED"
      "SOURCE_RETIRE_REQUESTED" -> "HOLD_SOURCE_RETIRE_REQUIRES_RECOVERY_PROOF"
      "FINALIZED_UNVERIFIED" -> "HOLD_COMPLETED_MARKER_NOT_AUTHORITY"
      else -> "DENY_UNKNOWN_MIGRATION_STEP"
    }
  }
}
