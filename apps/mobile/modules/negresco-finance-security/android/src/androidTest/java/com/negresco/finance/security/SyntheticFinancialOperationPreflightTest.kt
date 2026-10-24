package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * P0-1 boundary tests: the production Kotlin preflight can ONLY return HOLD.
 * These booleans are untrusted observations, not grants or crypto proofs.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticFinancialOperationPreflightTest {
  private fun evaluate(
    lifecycle: Boolean,
    crypto: Boolean,
    storage: Boolean
  ) = NativeFinancialOperationPreflight.evaluate(
    NativeFinancialOperationPreflight.Observations(lifecycle, crypto, storage)
  )

  @Test fun revokedLifecycleAlwaysDeniesRegardlessOfForgedSignals() {
    for (crypto in listOf(false, true)) for (storage in listOf(false, true)) {
      assertEquals(NativeFinancialOperationPreflight.Decision.HOLD_SESSION_REVOKED,
        evaluate(false, crypto, storage))
    }
  }

  @Test fun unavailableCryptoAndStorageDenyBeforeNativeAuthority() {
    assertEquals(NativeFinancialOperationPreflight.Decision.HOLD_STRONG_CRYPTO_NOT_PROVEN,
      evaluate(true, false, true))
    assertEquals(NativeFinancialOperationPreflight.Decision.HOLD_ENCRYPTED_STORAGE_NOT_PROVISIONED,
      evaluate(true, true, false))
  }

  @Test fun forgedAllTrueSignalsStillCannotAuthorizeAnything() {
    val verdict = evaluate(true, true, true)
    assertEquals(
      NativeFinancialOperationPreflight.Decision.HOLD_NATIVE_OWNER_AUTHORITY_NOT_IMPLEMENTED,
      verdict)
    assertTrue(NativeFinancialOperationPreflight.Decision.entries.all {
      it.name.startsWith("HOLD_")
    })
  }
}
