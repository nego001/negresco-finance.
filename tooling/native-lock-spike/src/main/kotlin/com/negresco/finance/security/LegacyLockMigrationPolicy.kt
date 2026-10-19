package com.negresco.finance.security

/**
 * Compatibility policy for the two untrusted AsyncStorage markers used by
 * Negresco Finance 3.1.2. Markers are NOT proof of a native authentication,
 * and their values must never be used to bypass native biometrics.
 *
 * This is only a fail-closed migration decision. It is not an Android
 * importer, a user-consent screen, or a one-time migration implementation.
 */
internal enum class LegacyLockMigrationDecision {
  PRESERVE_LOCK,
  NEEDS_EXPLICIT_SETUP,
  REJECT_INVALID
}

internal fun classifyLegacyLock(
  preference: String?,
  optOutJournal: String?
): LegacyLockMigrationDecision {
  // The pending journal overrides even a potentially persisted 'disabled'.
  if (optOutJournal == "pending") return LegacyLockMigrationDecision.PRESERVE_LOCK
  if (optOutJournal != null) return LegacyLockMigrationDecision.REJECT_INVALID
  return when (preference) {
    "enabled", "disable-pending" -> LegacyLockMigrationDecision.PRESERVE_LOCK
    null, "disabled" -> LegacyLockMigrationDecision.NEEDS_EXPLICIT_SETUP
    else -> LegacyLockMigrationDecision.REJECT_INVALID
  }
}

internal class LegacyLockSetupRequired :
  IllegalStateException("Legacy opt-out/uninitialized lock requires explicit setup")
internal class LegacyLockInvalid :
  IllegalStateException("Legacy lock markers are invalid; migration refused")
