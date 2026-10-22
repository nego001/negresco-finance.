package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Synthetic migration preflight only. No preference reads, writes, secrets,
 * real biometric actions, Android context or user data.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticNativeLockMigrationPreflightTest {
  private fun check(
    expected: String,
    primary: String? = null,
    journal: String? = null,
    presence: String = "ABSENT",
    nativeRecord: String? = null
  ) {
    val actual = NativeLockMigrationPreflight.assess(primary, journal, presence, nativeRecord)
    assertEquals(expected, actual)
    assertTrue("No migration preflight may return allow/success/unlock: $actual",
      actual.startsWith("HOLD_") || actual.startsWith("DENY_"))
  }

  @Test fun initialInstallNeverProvisionsOrUnlocks() {
    check("HOLD_UNPROVISIONED_REQUIRES_OWNER_CONFIRMATION")
  }

  @Test fun enabledLegacyStateRequiresStrongNativeOwnerAuthentication() {
    check("HOLD_STRONG_NATIVE_AUTHENTICATION_REQUIRED", primary = "enabled")
  }

  @Test fun disabledLegacyStateIsNotAuthenticatedOptOut() {
    check("HOLD_DISABLED_IS_NOT_AUTHENTICATED_OPTOUT", primary = "disabled")
  }

  @Test fun pendingOptOutJournalOverridesAnyLegacyPrimary() {
    for (value in listOf(null, "enabled", "disabled", "disable-pending", "garbage")) {
      check("HOLD_LEGACY_OPTOUT_RECOVERY", primary = value, journal = "pending")
    }
  }

  @Test fun oldPendingMarkerWithoutJournalStillRequiresRecovery() {
    check("HOLD_LEGACY_OPTOUT_RECOVERY", primary = "disable-pending")
  }

  @Test fun unknownLegacyPrimaryAndJournalFailClosed() {
    check("DENY_UNKNOWN_LEGACY_PREFERENCE", primary = "unknown")
    check("DENY_UNKNOWN_LEGACY_JOURNAL", primary = "enabled", journal = "foreign")
  }

  @Test fun existingNativeRecordIsNeverOverwrittenOrAuthenticated() {
    check("HOLD_NATIVE_EXISTS_NEEDS_AUTHORITY", primary = "disabled",
      presence = "PRESENT_UNVERIFIED", nativeRecord = "VALID_UNTRUSTED")
    check("HOLD_NATIVE_DISABLE_PENDING", primary = "enabled",
      presence = "PRESENT_UNVERIFIED", nativeRecord = "PENDING_DISABLE_LOCKED")
    check("HOLD_LIFECYCLE_REVOKED", primary = "enabled",
      presence = "PRESENT_UNVERIFIED", nativeRecord = "LIFECYCLE_REVOKED_LOCKED")
  }

  @Test fun hostileOrContradictoryNativeStateCannotPromoteLegacyFlags() {
    for (status in listOf("UNSAFE_ENTRY", "UNAVAILABLE", "VERIFIED_LIVE_CURRENT")) {
      check("DENY_NATIVE_STORAGE_UNSAFE", primary = "disabled", presence = status)
    }
    for (record in listOf(null, "INVALID_LOCKED", "VERIFIED_LIVE_CURRENT")) {
      check("DENY_NATIVE_RECORD_UNVERIFIED", primary = "enabled",
        presence = "PRESENT_UNVERIFIED", nativeRecord = record)
    }
    check("DENY_NATIVE_CONTRADICTORY", primary = "enabled",
      presence = "PRESENT_UNVERIFIED", nativeRecord = "MISSING_REQUIRES_VERIFIED_MIGRATION")
    check("DENY_NATIVE_CONTRADICTORY", primary = "disabled",
      presence = "ABSENT", nativeRecord = "VALID_UNTRUSTED")
  }
}
