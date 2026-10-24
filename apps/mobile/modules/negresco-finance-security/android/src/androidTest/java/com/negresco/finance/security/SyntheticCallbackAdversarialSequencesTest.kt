package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * P0-1 seeded adversarial sequences. Android emulator only, zero real accounts.
 * Receipts are synthetic, not cryptographic proof; every verdict MUST be HOLD.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticCallbackAdversarialSequencesTest {
  private val read = NativeSyntheticOperationAttemptFence.Intent.READ_DISPOSABLE_FIXTURE
  private val write = NativeSyntheticOperationAttemptFence.Intent.WRITE_DISPOSABLE_FIXTURE

  private fun assertDenied(decision: NativeSyntheticCallbackDenialFence.Decision) {
    assertTrue("only HOLD_* results are legal, got $decision",
      decision.name.startsWith("HOLD_"))
  }

  @Test fun hundredsOfForgedSuccessCallbacksNeverAuthorize() {
    repeat(256) { i ->
      val fence = NativeSyntheticCallbackDenialFence()
      fence.enterForeground()
      val intent = if (i % 2 == 0) read else write
      val receipt = fence.begin(intent, true, true).receipt
      assertNotNull(receipt)
      assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED,
        fence.observeUntrustedCallback(receipt, intent, true))
      assertDenied(fence.observeUntrustedCallback(receipt, intent, true))
      fence.destroy()
    }
  }

  @Test fun crossIntentInjectionConsumesAttemptBeforeCorrection() {
    repeat(256) { i ->
      val fence = NativeSyntheticCallbackDenialFence()
      fence.enterForeground()
      val intent = if (i % 2 == 0) read else write
      val wrong = if (intent == read) write else read
      val receipt = fence.begin(intent, true, true).receipt
      assertNotNull(receipt)
      assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_INTENT_MISMATCH,
        fence.observeUntrustedCallback(receipt, wrong, true))
      assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_NO_PENDING_CALLBACK,
        fence.observeUntrustedCallback(receipt, intent, true))
      fence.destroy()
    }
  }

  @Test fun invalidatedForegroundAndDestroyedSessionsAlwaysRejectLateCallbacks() {
    repeat(256) { i ->
      val fence = NativeSyntheticCallbackDenialFence()
      fence.enterForeground()
      val old = fence.begin(read, true, true).receipt
      assertNotNull(old)
      fence.leaveForeground()
      assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_SESSION_REVOKED,
        fence.observeUntrustedCallback(old, read, true))
      fence.enterForeground()
      val current = fence.begin(if (i % 2 == 0) read else write, true, true).receipt
      assertNotNull(current)
      assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_RECEIPT_MISMATCH,
        fence.observeUntrustedCallback(old, read, true))
      fence.destroy()
      assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_SESSION_REVOKED,
        fence.observeUntrustedCallback(current, read, true))
    }
  }

  @Test fun randomizedClaimsNeverProduceAReceiptAfterDeniedPreflight() {
    val random = java.util.Random(0x5EEDL)
    repeat(512) {
      val fence = NativeSyntheticCallbackDenialFence()
      fence.enterForeground()
      val strong = random.nextBoolean()
      val store = random.nextBoolean()
      val intent = if (random.nextBoolean()) read else write
      val result = fence.begin(intent, strong, store)
      assertTrue(result.preflight.name.startsWith("HOLD_"))
      if (!strong || !store) {
        assertNull(result.receipt)
        assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_NO_PENDING_CALLBACK,
          fence.observeUntrustedCallback(null, intent, true))
      } else {
        assertNotNull(result.receipt)
        assertDenied(fence.observeUntrustedCallback(result.receipt, intent, true))
      }
      // Duplicated foreground must not start a new operation.
      fence.enterForeground()
      assertNull(fence.begin(intent, true, true).receipt)
      fence.destroy()
    }
  }
}
