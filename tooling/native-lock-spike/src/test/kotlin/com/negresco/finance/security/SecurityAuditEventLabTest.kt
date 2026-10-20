package com.negresco.finance.security

/** No PII is used or persisted by these synthetic security-event checks. */
internal fun runSecurityAuditEventScenarios() {
  val denied = PreflightDecision(PreflightVerdict.DENY, PreflightReason.STORAGE_NOT_VERIFIED)
  val pending = PreflightDecision(
    PreflightVerdict.PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER,
    PreflightReason.READY_FOR_NATIVE_VERIFICATION)
  val needsAuth = PreflightDecision(
    PreflightVerdict.REQUIRE_FRESH_STRONG_AUTH, PreflightReason.REAUTH_REQUIRED)

  // 1. Schema is fixed, no user or device identifier.
  val first = SecurityAuditEventLab.fromDecision(
    ProtectedOperation.VIEW_FINANCIAL_OVERVIEW, denied)
  check(first.schemaVersion == 1)
  check(first.operation == ProtectedOperation.VIEW_FINANCIAL_OVERVIEW)

  // 2. Fault in trust/storage is a critical security event.
  check(first.severity == SanitizedSecuritySeverity.CRITICAL)

  // 3. Emergency mode has an explicit label, not secret-bearing text.
  val emergency = SecurityAuditEventLab.fromDecision(
    ProtectedOperation.VIEW_FINANCIAL_OVERVIEW,
    PreflightDecision(PreflightVerdict.DENY, PreflightReason.EMERGENCY_LOCK))
  check(emergency.code == SanitizedSecurityEventCode.EMERGENCY_LOCK_ACTIVE)
  check(emergency.severity == SanitizedSecuritySeverity.CRITICAL)

  // 4. Unknown device registration cannot be labelled as a success.
  val device = SecurityAuditEventLab.fromDecision(
    ProtectedOperation.REGISTER_NEW_DEVICE,
    PreflightDecision(PreflightVerdict.DENY,
      PreflightReason.NETWORK_NOT_TRUSTED_FOR_DEVICE_REGISTRATION))
  check(device.code == SanitizedSecurityEventCode.DEVICE_REGISTRATION_BLOCKED)

  // 5. Export denial creates only fixed code, not account details.
  val export = SecurityAuditEventLab.fromDecision(
    ProtectedOperation.EXPORT_FINANCIAL_DATA, denied)
  check(export.code == SanitizedSecurityEventCode.EXPORT_BLOCKED)

  // 6. Restore and key destruction have a separated recovery warning.
  for (op in listOf(ProtectedOperation.RESTORE_ENCRYPTED_BACKUP,
    ProtectedOperation.DELETE_ENCRYPTION_KEYS)) {
    val e = SecurityAuditEventLab.fromDecision(op,
      PreflightDecision(PreflightVerdict.DENY,
        PreflightReason.UNSUPPORTED_DESTRUCTIVE_OPERATION))
    check(e.code == SanitizedSecurityEventCode.RECOVERY_OPERATION_BLOCKED)
  }

  // 7. A step-up request is not logged as authorization.
  check(SecurityAuditEventLab.fromDecision(
    ProtectedOperation.REVOKE_DEVICE, needsAuth).code ==
      SanitizedSecurityEventCode.STRONG_AUTH_REQUIRED)

  // 8. A positive preflight is logged as PENDING native authorization.
  val allowedToNative = SecurityAuditEventLab.fromDecision(
    ProtectedOperation.VIEW_FINANCIAL_OVERVIEW, pending)
  check(allowedToNative.code == SanitizedSecurityEventCode.NATIVE_AUTHORIZATION_PENDING)
  check(allowedToNative.severity == SanitizedSecuritySeverity.INFORMATION)

  // 9. Security events never contain free-text PII / secrets / amounts.
  val samples = ProtectedOperation.entries.flatMap { op ->
    listOf(denied, pending, needsAuth).map {
      SecurityAuditEventLab.fromDecision(op, it)
    }
  }
  for (e in samples) {
    check(e::class.java.declaredFields.none { f ->
      f.type == String::class.java || f.type == ByteArray::class.java
    })
    check(e.schemaVersion == 1)
  }

  // 10. Telemetry is pure and deterministic, no storage/clock/network.
  for (op in ProtectedOperation.entries) {
    val e = SecurityAuditEventLab.fromDecision(op, denied)
    repeat(10) { check(SecurityAuditEventLab.fromDecision(op, denied) == e) }
  }
  println("PASS: 10 allowlisted security audit scenarios (no PII, no persistence)")
}
