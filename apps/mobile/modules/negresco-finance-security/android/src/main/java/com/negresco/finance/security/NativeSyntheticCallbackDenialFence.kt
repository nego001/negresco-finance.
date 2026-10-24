package com.negresco.finance.security

/**
 * P0-1: negative-only callback correlation in Kotlin, no auth or I/O.
 *
 * A Receipt is an in-process identity marker, NOT a secret, proof of
 * biometric consent or transferable capability. No JS-facing module invokes
 * this fixture. Neither boolean claims nor matching receipts grant access.
 */
internal class NativeSyntheticCallbackDenialFence {
  internal enum class Decision {
    HOLD_SESSION_REVOKED,
    HOLD_NO_PENDING_CALLBACK,
    HOLD_RECEIPT_MISMATCH,
    HOLD_INTENT_MISMATCH,
    HOLD_UNTRUSTED_CALLBACK,
    HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED
  }

  internal class Receipt internal constructor(
    val intent: NativeSyntheticOperationAttemptFence.Intent
  )

  internal data class BeginResult(
    val preflight: NativeSyntheticOperationAttemptFence.Decision,
    val receipt: Receipt?
  )

  private val attempts = NativeSyntheticOperationAttemptFence()
  private var foreground = false
  private var destroyed = false
  private var pending: Receipt? = null

  @Synchronized fun enterForeground() {
    if (destroyed || foreground) return
    foreground = true
    attempts.foreground()
  }

  @Synchronized fun leaveForeground() {
    foreground = false
    pending = null
    attempts.background()
  }

  @Synchronized fun destroy() {
    destroyed = true
    foreground = false
    pending = null
    attempts.destroy()
  }

  @Synchronized fun begin(
    intent: NativeSyntheticOperationAttemptFence.Intent,
    claimedStrongCrypto: Boolean,
    claimedEncryptedStore: Boolean
  ): BeginResult {
    // No real operation occurs: even the complete-looking receipt is
    // created after a DENY verdict, solely for a negative callback rehearsal.
    val preflight = attempts.attempt(intent, claimedStrongCrypto, claimedEncryptedStore)
    val receipt = if (foreground && !destroyed &&
      preflight == NativeSyntheticOperationAttemptFence.Decision.HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED
    ) Receipt(intent) else null
    pending = receipt
    return BeginResult(preflight, receipt)
  }

  @Synchronized fun observeUntrustedCallback(
    receipt: Receipt?,
    intent: NativeSyntheticOperationAttemptFence.Intent,
    allegedBiometricSuccess: Boolean
  ): Decision {
    if (!foreground || destroyed) return Decision.HOLD_SESSION_REVOKED
    val expected = pending ?: return Decision.HOLD_NO_PENDING_CALLBACK
    // Consume BEFORE inspecting any caller-controlled fields. A forged
    // callback burns the attempt, never allowing a fallback/replay.
    pending = null
    if (receipt !== expected) return Decision.HOLD_RECEIPT_MISMATCH
    if (intent != expected.intent) return Decision.HOLD_INTENT_MISMATCH
    if (!allegedBiometricSuccess) return Decision.HOLD_UNTRUSTED_CALLBACK
    // Even matching intent+receipt+claimed true CANNOT grant authorization.
    return Decision.HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED
  }
}
