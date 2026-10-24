package com.negresco.finance.security

/**
 * Fase 1: pure, native-only PREFLIGHT for migrating the old UI-only lock.
 *
 * Legacy JS AsyncStorage values are untrusted. This class never calls
 * DataStore, Keystore or BiometricPrompt, never authenticates a user, creates
 * a record, or enables a finance session. Even a syntactically valid legacy
 * "disabled" is not proof of an authenticated opt-out.
 *
 * It is deliberately NOT exported to JavaScript as a migration API.
 * The output is always a HOLD or DENY reason, never ALLOW.
 */
internal object NativeLockMigrationPreflight {
  private const val LEGACY_ENABLED = "enabled"
  private const val LEGACY_DISABLED = "disabled"
  private const val LEGACY_DISABLE_PENDING = "disable-pending"
  private const val JOURNAL_PENDING = "pending"

  fun assess(
    legacyPrimary: String?,
    legacyOptOutJournal: String?,
    nativePresence: String,
    nativeRecord: String?
  ): String {
    // A native record must never be replaced based on an untrusted JS flag.
    if (nativePresence == "UNSAFE_ENTRY" || nativePresence == "UNAVAILABLE" ||
      nativePresence !in setOf("ABSENT", "PRESENT_UNVERIFIED"))
      return "DENY_NATIVE_STORAGE_UNSAFE"

    if (nativePresence == "PRESENT_UNVERIFIED") {
      return when (nativeRecord) {
        "VALID_UNTRUSTED" -> "HOLD_NATIVE_EXISTS_NEEDS_AUTHORITY"
        "PENDING_DISABLE_LOCKED" -> "HOLD_NATIVE_DISABLE_PENDING"
        "LIFECYCLE_REVOKED_LOCKED" -> "HOLD_LIFECYCLE_REVOKED"
        "MISSING_REQUIRES_VERIFIED_MIGRATION" -> "DENY_NATIVE_CONTRADICTORY"
        else -> "DENY_NATIVE_RECORD_UNVERIFIED"
      }
    }

    // A claim of having read a record while the native file is absent is
    // contradictory; fail closed rather than promoting a legacy value.
    if (nativeRecord != null)
      return "DENY_NATIVE_CONTRADICTORY"

    // No native file: do not synthesize DataStore simply because it is absent.
    // Any legacy pending opt-out must be recovered before considering migration.
    if (legacyOptOutJournal == JOURNAL_PENDING)
      return "HOLD_LEGACY_OPTOUT_RECOVERY"
    if (legacyOptOutJournal != null)
      return "DENY_UNKNOWN_LEGACY_JOURNAL"

    return when (legacyPrimary) {
      null -> "HOLD_UNPROVISIONED_REQUIRES_OWNER_CONFIRMATION"
      LEGACY_ENABLED -> "HOLD_STRONG_NATIVE_AUTHENTICATION_REQUIRED"
      LEGACY_DISABLE_PENDING -> "HOLD_LEGACY_OPTOUT_RECOVERY"
      LEGACY_DISABLED -> "HOLD_DISABLED_IS_NOT_AUTHENTICATED_OPTOUT"
      else -> "DENY_UNKNOWN_LEGACY_PREFERENCE"
    }
  }
}
