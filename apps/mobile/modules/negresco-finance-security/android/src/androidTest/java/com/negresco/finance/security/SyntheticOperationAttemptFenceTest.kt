package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * P0-1: DENY-ONLY one-shot synthetic operation intent.
 * No biometric prompt, no financial storage, no actual native operation.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticOperationAttemptFenceTest {
  private val denial = NativeSyntheticOperationAttemptFence.Decision.HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED

  @Test fun attemptWithoutForegroundCannotRun() {
    val fence = NativeSyntheticOperationAttemptFence()
    assertEquals(NativeSyntheticOperationAttemptFence.Decision.HOLD_SESSION_REVOKED,
      fence.attempt(NativeSyntheticOperationAttemptFence.Intent.READ_DISPOSABLE_FIXTURE, true, true))
  }

  @Test fun repeatedIntentInSameForegroundEpochAlwaysDenies() {
    val fence = NativeSyntheticOperationAttemptFence()
    fence.foreground()
    assertEquals(denial,
      fence.attempt(NativeSyntheticOperationAttemptFence.Intent.READ_DISPOSABLE_FIXTURE, true, true))
    assertEquals(NativeSyntheticOperationAttemptFence.Decision.HOLD_REPLAYED_ATTEMPT,
      fence.attempt(NativeSyntheticOperationAttemptFence.Intent.WRITE_DISPOSABLE_FIXTURE, true, true))
  }

  @Test fun backgroundAndDestroyRevokeSyntheticOperationEpoch() {
    val fence = NativeSyntheticOperationAttemptFence()
    fence.foreground()
    assertEquals(denial,
      fence.attempt(NativeSyntheticOperationAttemptFence.Intent.READ_DISPOSABLE_FIXTURE, true, true))
    fence.background()
    assertEquals(NativeSyntheticOperationAttemptFence.Decision.HOLD_SESSION_REVOKED,
      fence.attempt(NativeSyntheticOperationAttemptFence.Intent.WRITE_DISPOSABLE_FIXTURE, true, true))
    fence.foreground()
    assertEquals(denial,
      fence.attempt(NativeSyntheticOperationAttemptFence.Intent.WRITE_DISPOSABLE_FIXTURE, true, true))
    fence.destroy()
    fence.foreground()
    assertEquals(NativeSyntheticOperationAttemptFence.Decision.HOLD_SESSION_REVOKED,
      fence.attempt(NativeSyntheticOperationAttemptFence.Intent.READ_DISPOSABLE_FIXTURE, true, true))
  }

  @Test fun forgedStrongCryptoAndStorageRemainDeniedForBothIntents() {
    for (intent in NativeSyntheticOperationAttemptFence.Intent.entries) {
      val fence = NativeSyntheticOperationAttemptFence()
      fence.foreground()
      assertEquals(
        NativeSyntheticOperationAttemptFence.Decision.HOLD_STRONG_CRYPTO_NOT_PROVEN,
        fence.attempt(intent, false, true))
      fence.background()
      fence.foreground()
      assertEquals(
        NativeSyntheticOperationAttemptFence.Decision.HOLD_ENCRYPTED_STORAGE_NOT_PROVISIONED,
        fence.attempt(intent, true, false))
      fence.background()
      fence.foreground()
      assertEquals(denial, fence.attempt(intent, true, true))
    }
    assertTrue(NativeSyntheticOperationAttemptFence.Decision.entries.all {
      it.name.startsWith("HOLD_")
    })
  }
}
