package com.negresco.finance.security

/**
 * Phase 1 / P0-1: native-only DENY-ONLY rehearsal of one operation attempt.
 *
 * This class does not perform an operation, prove biometrics, access SQLCipher,
 * expose a capability, or authorize a key. It is intentionally not referenced
 * by the Expo module. Claim booleans are UNTRUSTED and cannot yield ALLOW.
 *
 * An attempt is consumed once for a native foreground epoch. On background
 * or destruction, the lifecycle fence revokes the epoch before any new check.
 */
internal class NativeSyntheticOperationAttemptFence(
  private val lifecycle: NativeLockLifecycleFence = NativeLockLifecycleFence()
) {
  internal enum class Intent {
    READ_DISPOSABLE_FIXTURE,
    WRITE_DISPOSABLE_FIXTURE
  }

  internal enum class Decision {
    HOLD_SESSION_REVOKED,
    HOLD_REPLAYED_ATTEMPT,
    HOLD_STRONG_CRYPTO_NOT_PROVEN,
    HOLD_ENCRYPTED_STORAGE_NOT_PROVISIONED,
    HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED
  }

  private var consumedForegroundEpoch: Long? = null
  private var foregroundObserved = false
  private var destroyed = false

  @Synchronized fun foreground() {
    // A duplicate Android foreground notification is not a new session:
    // it must not mint another diagnostic epoch and bypass one-shot denial.
    if (destroyed || foregroundObserved) return
    foregroundObserved = true
    lifecycle.onForeground()
  }

  @Synchronized fun background() {
    foregroundObserved = false
    lifecycle.onBackground()
  }

  @Synchronized fun destroy() {
    foregroundObserved = false
    destroyed = true
    lifecycle.onDestroyed()
  }

  /**
   * Intent is a typed synthetic test label, not a financial operation API.
   * Calling this method NEVER invokes a user-visible or native I/O operation.
   */
  @Synchronized fun attempt(
    intent: Intent,
    claimedStrongCrypto: Boolean,
    claimedEncryptedStore: Boolean
  ): Decision {
    val epoch = lifecycle.beginDiagnosticEpoch() ?: return Decision.HOLD_SESSION_REVOKED
    if (consumedForegroundEpoch == epoch) return Decision.HOLD_REPLAYED_ATTEMPT
    consumedForegroundEpoch = epoch

    // Both fictional intents obey exactly the same native denial path.
    val preflight = when (intent) {
      Intent.READ_DISPOSABLE_FIXTURE,
      Intent.WRITE_DISPOSABLE_FIXTURE ->
        NativeFinancialOperationPreflight.evaluate(
          NativeFinancialOperationPreflight.Observations(
            lifecycleCurrent = lifecycle.isStillDiagnosticEpoch(epoch),
            strongCryptoObserved = claimedStrongCrypto,
            encryptedStorePresent = claimedEncryptedStore
          )
        )
    }
    return when (preflight) {
      NativeFinancialOperationPreflight.Decision.HOLD_SESSION_REVOKED ->
        Decision.HOLD_SESSION_REVOKED
      NativeFinancialOperationPreflight.Decision.HOLD_STRONG_CRYPTO_NOT_PROVEN ->
        Decision.HOLD_STRONG_CRYPTO_NOT_PROVEN
      NativeFinancialOperationPreflight.Decision.HOLD_ENCRYPTED_STORAGE_NOT_PROVISIONED ->
        Decision.HOLD_ENCRYPTED_STORAGE_NOT_PROVISIONED
      NativeFinancialOperationPreflight.Decision.HOLD_NATIVE_OWNER_AUTHORITY_NOT_IMPLEMENTED ->
        Decision.HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED
    }
  }
}
