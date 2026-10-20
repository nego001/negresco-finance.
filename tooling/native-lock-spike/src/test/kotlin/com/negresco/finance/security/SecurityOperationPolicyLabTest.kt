package com.negresco.finance.security

/**
 * Deterministic offline safety checks, NOT proof of a real Android biometric
 * exchange. Every positive preflight still needs independent native validation.
 */
private fun trustedSignals() = SecuritySignals(
  inForeground = true,
  sessionVerified = true,
  storageVerified = true,
  trustedDevice = true,
  screenCaptureProtected = true,
  overlaySuspected = false,
  networkTrusted = true,
  riskTelemetryAvailable = true,
  suspiciousActivity = false,
  freshStrongAuthentication = true,
  emergencyLock = false,
  maximumProtection = false
)

private fun verdict(
  operation: ProtectedOperation,
  signals: SecuritySignals = trustedSignals()
): PreflightVerdict =
  SecurityOperationPolicyLab.evaluate(operation, signals).verdict

internal fun runSecurityOperationPolicyScenarios() {
  val DENY = PreflightVerdict.DENY
  val AUTH = PreflightVerdict.REQUIRE_FRESH_STRONG_AUTH
  val NATIVE = PreflightVerdict.PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER

  // 1. Emergency mode cannot be overridden by recent authentication.
  check(verdict(ProtectedOperation.VIEW_FINANCIAL_OVERVIEW,
    trustedSignals().copy(emergencyLock = true)) == DENY)

  // 2. Missing verified session cannot browse balances or export.
  for (op in ProtectedOperation.entries) {
    check(verdict(op, trustedSignals().copy(sessionVerified = false)) == DENY)
  }

  // 3. onStop or background revokes all executable entrypoints.
  for (op in ProtectedOperation.entries) {
    check(verdict(op, trustedSignals().copy(inForeground = false)) == DENY)
  }

  // 4. Storage corruption must not be confused with security being disabled.
  for (op in ProtectedOperation.entries) {
    check(verdict(op, trustedSignals().copy(storageVerified = false)) == DENY)
  }

  // 5. Unknown devices do not inherit privileges from authentication alone.
  for (op in ProtectedOperation.entries) {
    check(verdict(op, trustedSignals().copy(trustedDevice = false)) == DENY)
  }

  // 6. Screen overlays deny actions including sensitive reads and exports.
  for (op in ProtectedOperation.entries) {
    check(verdict(op, trustedSignals().copy(overlaySuspected = true)) == DENY)
  }

  // 7. A "disable lock" request is not implemented or automatically allowed.
  check(verdict(ProtectedOperation.DISABLE_BIOMETRIC_LOCK) == DENY)

  // 8. No hard-delete operation until audited, independently recoverable.
  check(verdict(ProtectedOperation.DELETE_ENCRYPTION_KEYS) == DENY)

  // 9. Restore needs separate verified recovery ceremony.
  check(verdict(ProtectedOperation.RESTORE_ENCRYPTED_BACKUP) == DENY)

  // 10. SecureWindow missing means export, reveal, and recovery changes denied.
  for (op in listOf(
    ProtectedOperation.EXPORT_FINANCIAL_DATA,
    ProtectedOperation.REVEAL_SENSITIVE_RECORD,
    ProtectedOperation.CHANGE_RECOVERY_MATERIAL
  )) {
    check(verdict(op, trustedSignals().copy(screenCaptureProtected = false)) == DENY)
  }

  // 11. Risk detection unavailable denies all security-critical changes.
  for (op in ProtectedOperation.entries) {
    if (op != ProtectedOperation.VIEW_FINANCIAL_OVERVIEW) {
      check(verdict(op,
        trustedSignals().copy(riskTelemetryAvailable = false)) == DENY)
    }
  }

  // 12. Suspicious activity denies high-risk operations even after step-up.
  for (op in ProtectedOperation.entries) {
    if (op != ProtectedOperation.VIEW_FINANCIAL_OVERVIEW) {
      check(verdict(op,
        trustedSignals().copy(suspiciousActivity = true)) == DENY)
    }
  }

  // 13. Unknown network cannot be used to enroll a new device.
  check(verdict(ProtectedOperation.REGISTER_NEW_DEVICE,
    trustedSignals().copy(networkTrusted = false)) == DENY)

  // 14. A trusted network must never substitute for fresh strong auth.
  check(verdict(ProtectedOperation.EXPORT_FINANCIAL_DATA,
    trustedSignals().copy(freshStrongAuthentication = false)) == AUTH)
  check(verdict(ProtectedOperation.REGISTER_NEW_DEVICE,
    trustedSignals().copy(freshStrongAuthentication = false)) == AUTH)

  // 15. Maximum protection adds step-up for reads on untrusted networks.
  check(verdict(ProtectedOperation.VIEW_FINANCIAL_OVERVIEW,
    trustedSignals().copy(maximumProtection = true, networkTrusted = false,
      freshStrongAuthentication = false)) == AUTH)
  check(verdict(ProtectedOperation.VIEW_FINANCIAL_OVERVIEW,
    trustedSignals().copy(maximumProtection = false, networkTrusted = false,
      freshStrongAuthentication = false)) == NATIVE)

  // 16. Unavailable fraud telemetry under maximum protection requires step-up
  // for otherwise allowed dashboard reads.
  check(verdict(ProtectedOperation.VIEW_FINANCIAL_OVERVIEW,
    trustedSignals().copy(maximumProtection = true,
      riskTelemetryAvailable = false, freshStrongAuthentication = false)) == AUTH)

  // 17. Disabling maximum protection still needs a fresh operation authenticator.
  check(verdict(ProtectedOperation.DISABLE_MAXIMUM_PROTECTION,
    trustedSignals().copy(freshStrongAuthentication = false)) == AUTH)
  check(verdict(ProtectedOperation.DISABLE_MAXIMUM_PROTECTION) == NATIVE)

  // 18. All positive preflights are conditional native checks, NEVER ALLOW.
  for (op in ProtectedOperation.entries) {
    val result = SecurityOperationPolicyLab.evaluate(op, trustedSignals())
    check(result.verdict != AUTH)
    check(result.verdict != PreflightVerdict.DENY ||
      op in listOf(ProtectedOperation.DISABLE_BIOMETRIC_LOCK,
        ProtectedOperation.DELETE_ENCRYPTION_KEYS,
        ProtectedOperation.RESTORE_ENCRYPTED_BACKUP))
    check(result.verdict != NATIVE ||
      result.reason == PreflightReason.READY_FOR_NATIVE_VERIFICATION)
  }

  // 19. Exhaustive variation of essential trust bits: no false-positive.
  for (mask in 0 until 256) {
    val base = trustedSignals().copy(
      inForeground = mask and 1 != 0,
      sessionVerified = mask and 2 != 0,
      storageVerified = mask and 4 != 0,
      trustedDevice = mask and 8 != 0,
      screenCaptureProtected = mask and 16 != 0,
      overlaySuspected = mask and 32 != 0,
      riskTelemetryAvailable = mask and 64 != 0,
      freshStrongAuthentication = mask and 128 != 0
    )
    val v = verdict(ProtectedOperation.EXPORT_FINANCIAL_DATA, base)
    if (!base.inForeground || !base.sessionVerified || !base.storageVerified ||
      !base.trustedDevice || !base.screenCaptureProtected ||
      base.overlaySuspected || !base.riskTelemetryAvailable) {
      check(v == DENY)
    } else if (!base.freshStrongAuthentication) {
      check(v == AUTH)
    } else check(v == NATIVE)
  }

  // 20. A policy decision is deterministic and carries no reusable grant.
  val input = trustedSignals().copy(maximumProtection = true)
  val d = SecurityOperationPolicyLab.evaluate(ProtectedOperation.REVOKE_DEVICE, input)
  repeat(20) {
    check(SecurityOperationPolicyLab.evaluate(ProtectedOperation.REVOKE_DEVICE, input) == d)
  }
  println("PASS: 20 offline risk preflight scenarios plus 256 trust-state combinations (no Android authorization)")
}
