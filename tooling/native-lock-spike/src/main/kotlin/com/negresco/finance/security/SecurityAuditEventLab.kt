package com.negresco.finance.security

/**
 * Privacy-by-design proof for future Central de Seguranca (SEC-08).
 * Only closed enums, never arbitrary strings or user-controlled metadata.
 * No network, disk, analytics SDK, identifiers or PII in this module.
 *
 * Not a persistent audit log; no integrity/retention guarantees. Production
 * telemetry needs a separate threat model, encrypted storage and LGPD policy.
 */
internal enum class SanitizedSecurityEventCode {
  FINANCIAL_ACCESS_BLOCKED,
  STRONG_AUTH_REQUIRED,
  NATIVE_AUTHORIZATION_PENDING,
  DEVICE_REGISTRATION_BLOCKED,
  EXPORT_BLOCKED,
  RECOVERY_OPERATION_BLOCKED,
  EMERGENCY_LOCK_ACTIVE
}

internal enum class SanitizedSecuritySeverity { INFORMATION, WARNING, CRITICAL }

internal data class SanitizedSecurityEvent(
  val schemaVersion: Int,
  val code: SanitizedSecurityEventCode,
  val severity: SanitizedSecuritySeverity,
  val operation: ProtectedOperation,
  val reason: PreflightReason
)

internal object SecurityAuditEventLab {
  /**
   * All events are structured, allowlisted and harmless to display in a
   * local security center. No timestamps, IDs, secrets or amounts.
   */
  fun fromDecision(
    operation: ProtectedOperation,
    decision: PreflightDecision
  ): SanitizedSecurityEvent {
    val code = when {
      decision.reason == PreflightReason.EMERGENCY_LOCK ->
        SanitizedSecurityEventCode.EMERGENCY_LOCK_ACTIVE
      operation == ProtectedOperation.REGISTER_NEW_DEVICE &&
        decision.verdict == PreflightVerdict.DENY ->
        SanitizedSecurityEventCode.DEVICE_REGISTRATION_BLOCKED
      operation == ProtectedOperation.EXPORT_FINANCIAL_DATA &&
        decision.verdict == PreflightVerdict.DENY ->
        SanitizedSecurityEventCode.EXPORT_BLOCKED
      operation == ProtectedOperation.RESTORE_ENCRYPTED_BACKUP ||
        operation == ProtectedOperation.CHANGE_RECOVERY_MATERIAL ||
        operation == ProtectedOperation.DELETE_ENCRYPTION_KEYS ->
        SanitizedSecurityEventCode.RECOVERY_OPERATION_BLOCKED
      decision.verdict == PreflightVerdict.REQUIRE_FRESH_STRONG_AUTH ->
        SanitizedSecurityEventCode.STRONG_AUTH_REQUIRED
      decision.verdict == PreflightVerdict.DENY ->
        SanitizedSecurityEventCode.FINANCIAL_ACCESS_BLOCKED
      else ->
        SanitizedSecurityEventCode.NATIVE_AUTHORIZATION_PENDING
    }
    val severity = when {
      decision.reason == PreflightReason.EMERGENCY_LOCK ||
        decision.reason == PreflightReason.STORAGE_NOT_VERIFIED ||
        decision.reason == PreflightReason.DEVICE_NOT_TRUSTED ||
        decision.reason == PreflightReason.HIGH_RISK_CONTEXT ->
        SanitizedSecuritySeverity.CRITICAL
      decision.verdict == PreflightVerdict.DENY ||
        decision.verdict == PreflightVerdict.REQUIRE_FRESH_STRONG_AUTH ->
        SanitizedSecuritySeverity.WARNING
      else -> SanitizedSecuritySeverity.INFORMATION
    }
    return SanitizedSecurityEvent(
      schemaVersion = 1, code = code, severity = severity,
      operation = operation, reason = decision.reason
    )
  }
}
