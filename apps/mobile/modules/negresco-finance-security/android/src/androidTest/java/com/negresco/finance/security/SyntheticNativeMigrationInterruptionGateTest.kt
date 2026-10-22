package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Tests pure planning states only; no files, preferences, Keystore, biometric
 * prompts or transactions. Simulated "durable" claims are NOT verified proof.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticNativeMigrationInterruptionGateTest {
  private fun inspect(
    step: String?,
    journal: String?,
    sourcePresent: Boolean = true,
    presence: String = "ABSENT",
    record: String? = null,
    active: Boolean = true
  ): String = NativeLockMigrationInterruptionGate.inspect(
    step, journal, sourcePresent, presence, record, active
  )

  @Test fun interruptionBeforeIntentCannotAutoProvision() {
    assertEquals("HOLD_OWNER_AUTH_REQUIRED", inspect("NOT_STARTED", null))
    assertEquals("DENY_UNEXPECTED_MIGRATION_ARTIFACT",
      inspect("NOT_STARTED", null, presence = "PRESENT_UNVERIFIED"))
  }

  @Test fun intentAndBackupInterruptedCannotAdvanceWithoutVerification() {
    assertEquals("HOLD_RESUME_REQUIRES_OWNER_AUTH",
      inspect("INTENT_RECORDED", "pending"))
    assertEquals("HOLD_BACKUP_PROOF_REQUIRED",
      inspect("SOURCE_BACKED_UP", "pending"))
    assertEquals("DENY_DURABLE_INTENT_MISSING",
      inspect("SOURCE_BACKED_UP", null))
    assertEquals("DENY_PREMATURE_COMPLETION_CLAIM",
      inspect("SOURCE_BACKED_UP", "completed"))
  }

  @Test fun stagedTargetIsNotAnAuthenticatedMigration() {
    assertEquals("HOLD_STAGED_NOT_AUTHENTICATED",
      inspect("NATIVE_STAGED", "pending",
        presence = "PRESENT_UNVERIFIED", record = "VALID_UNTRUSTED"))
    assertEquals("DENY_TARGET_RECORD_UNVERIFIED",
      inspect("NATIVE_STAGED", "pending",
        presence = "PRESENT_UNVERIFIED", record = "INVALID_LOCKED"))
  }

  @Test fun restoredOlderTargetOrPrematureTargetIsRejected() {
    assertEquals("DENY_TARGET_MISSING_OR_RESTORED",
      inspect("NATIVE_STAGED", "pending"))
    assertEquals("DENY_TARGET_PREMATURE_OR_REPLAYED",
      inspect("INTENT_RECORDED", "pending",
        presence = "PRESENT_UNVERIFIED", record = "VALID_UNTRUSTED"))
    assertEquals("DENY_SOURCE_LOST_BEFORE_VERIFIED_COMMIT",
      inspect("NATIVE_STAGED", "pending", sourcePresent = false,
        presence = "PRESENT_UNVERIFIED", record = "VALID_UNTRUSTED"))
  }

  @Test fun sourceRetirementRequiresIndependentRecoveryProof() {
    assertEquals("HOLD_SOURCE_RETIRE_REQUIRES_RECOVERY_PROOF",
      inspect("SOURCE_RETIRE_REQUESTED", "finalizing",
        presence = "PRESENT_UNVERIFIED", record = "VALID_UNTRUSTED"))
  }

  @Test fun completedMarkerDoesNotProveOwnerOrGrantAccess() {
    assertEquals("HOLD_COMPLETED_MARKER_NOT_AUTHORITY",
      inspect("FINALIZED_UNVERIFIED", "completed", sourcePresent = false,
        presence = "PRESENT_UNVERIFIED", record = "VALID_UNTRUSTED"))
    assertEquals("HOLD_FINALIZATION_INCOMPLETE",
      inspect("FINALIZED_UNVERIFIED", "pending", sourcePresent = false,
        presence = "PRESENT_UNVERIFIED", record = "VALID_UNTRUSTED"))
  }

  @Test fun invalidOrRestoredJournalAndLifecycleAreBlocked() {
    assertEquals("DENY_UNKNOWN_MIGRATION_STEP", inspect("UNLOCKED", "completed"))
    assertEquals("DENY_UNKNOWN_JOURNAL", inspect("INTENT_RECORDED", "forged"))
    assertEquals("HOLD_LIFECYCLE_REVOKED", inspect("INTENT_RECORDED", "pending", active = false))
    assertEquals("DENY_NATIVE_STORAGE_UNSAFE",
      inspect("NATIVE_STAGED", "pending", presence = "UNSAFE_ENTRY"))
  }

  @Test fun exhaustiveSyntheticCrashMatrixNeverAuthorizesFinancialData() {
    val steps = listOf(
      null, "NOT_STARTED", "INTENT_RECORDED", "SOURCE_BACKED_UP",
      "NATIVE_STAGED", "SOURCE_RETIRE_REQUESTED", "FINALIZED_UNVERIFIED",
      "UNLOCKED"
    )
    val journals = listOf(null, "pending", "finalizing", "completed", "forged")
    val presences = listOf("ABSENT", "PRESENT_UNVERIFIED", "UNSAFE_ENTRY", "UNAVAILABLE")
    val records = listOf(null, "VALID_UNTRUSTED", "INVALID_LOCKED", "VERIFIED_LIVE_CURRENT")
    var checks = 0
    for (step in steps)
      for (journal in journals)
        for (presence in presences)
          for (record in records)
            for (source in listOf(true, false))
              for (active in listOf(true, false)) {
                val result = inspect(step, journal, source, presence, record, active)
                assertTrue("No crash state may authorize: $result",
                  result.startsWith("HOLD_") || result.startsWith("DENY_"))
                checks += 1
              }
    assertEquals(2560, checks)
  }
}
