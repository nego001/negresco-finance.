package com.negresco.finance.security

/**
 * P0-1 starting boundary, compiled in src/main but NOT invoked or exported.
 *
 * This object is deliberately DENY-ONLY. These inputs are NOT cryptographic
 * evidence, and a true value must never be interpreted as permission.
 * A future audited authorizer must verify BiometricPrompt(CryptoObject)
 * inside Kotlin before it can even consider opening SQLCipher.
 */
internal object NativeFinancialOperationPreflight {
  internal enum class Decision {
    HOLD_SESSION_REVOKED,
    HOLD_STRONG_CRYPTO_NOT_PROVEN,
    HOLD_ENCRYPTED_STORAGE_NOT_PROVISIONED,
    HOLD_NATIVE_OWNER_AUTHORITY_NOT_IMPLEMENTED
  }

  internal data class Observations(
    val lifecycleCurrent: Boolean,
    val strongCryptoObserved: Boolean,
    val encryptedStorePresent: Boolean
  )

  fun evaluate(observations: Observations): Decision = when {
    !observations.lifecycleCurrent -> Decision.HOLD_SESSION_REVOKED
    !observations.strongCryptoObserved -> Decision.HOLD_STRONG_CRYPTO_NOT_PROVEN
    !observations.encryptedStorePresent ->
      Decision.HOLD_ENCRYPTED_STORAGE_NOT_PROVISIONED
    else -> Decision.HOLD_NATIVE_OWNER_AUTHORITY_NOT_IMPLEMENTED
  }
}
