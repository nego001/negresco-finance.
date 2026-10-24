package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Android emulator only. All callbacks are fabricated and DENIED. */
@RunWith(AndroidJUnit4::class)
class SyntheticCallbackDenialFenceTest {
  private val read = NativeSyntheticOperationAttemptFence.Intent.READ_DISPOSABLE_FIXTURE
  private val write = NativeSyntheticOperationAttemptFence.Intent.WRITE_DISPOSABLE_FIXTURE
  private val unsupported = NativeSyntheticCallbackDenialFence.Decision.HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED

  @Test fun callbackWithoutPendingAttemptIsDenied() {
    val fence = NativeSyntheticCallbackDenialFence()
    fence.enterForeground()
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_NO_PENDING_CALLBACK,
      fence.observeUntrustedCallback(null, read, true))
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_NO_PENDING_CALLBACK,
      fence.observeUntrustedCallback(NativeSyntheticCallbackDenialFence.Receipt(read), read, true))
  }

  @Test fun forgedSuccessWithMatchingIntentAndReceiptCannotAuthorize() {
    val fence = NativeSyntheticCallbackDenialFence()
    fence.enterForeground()
    val request = fence.begin(read, true, true)
    assertEquals(NativeSyntheticOperationAttemptFence.Decision.HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED,
      request.preflight)
    assertNotNull(request.receipt)
    assertEquals(unsupported, fence.observeUntrustedCallback(request.receipt, read, true))
    assertTrue(NativeSyntheticCallbackDenialFence.Decision.entries.all {
      it.name.startsWith("HOLD_")
    })
  }

  @Test fun wrongIntentBurnsAttemptAndCorrectedReplayIsDenied() {
    val fence = NativeSyntheticCallbackDenialFence()
    fence.enterForeground()
    val receipt = fence.begin(read, true, true).receipt
    assertNotNull(receipt)
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_INTENT_MISMATCH,
      fence.observeUntrustedCallback(receipt, write, true))
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_NO_PENDING_CALLBACK,
      fence.observeUntrustedCallback(receipt, read, true))
  }

  @Test fun staleReceiptAfterBackgroundCannotConsumeNewEpoch() {
    val fence = NativeSyntheticCallbackDenialFence()
    fence.enterForeground()
    val old = fence.begin(read, true, true).receipt
    assertNotNull(old)
    fence.leaveForeground()
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_SESSION_REVOKED,
      fence.observeUntrustedCallback(old, read, true))
    fence.enterForeground()
    val current = fence.begin(read, true, true).receipt
    assertNotNull(current)
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_RECEIPT_MISMATCH,
      fence.observeUntrustedCallback(old, read, true))
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_NO_PENDING_CALLBACK,
      fence.observeUntrustedCallback(current, read, true))
  }

  @Test fun cancelledClaimAndPreflightFailureCannotTurnIntoApproval() {
    val fence = NativeSyntheticCallbackDenialFence()
    fence.enterForeground()
    val fail = fence.begin(write, false, true)
    assertNull(fail.receipt)
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_NO_PENDING_CALLBACK,
      fence.observeUntrustedCallback(null, write, true))
    fence.leaveForeground()
    fence.enterForeground()
    val receipt = fence.begin(write, true, true).receipt
    assertNotNull(receipt)
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_UNTRUSTED_CALLBACK,
      fence.observeUntrustedCallback(receipt, write, false))
  }

  @Test fun destructionAndDuplicateForegroundNeverResurrectReceipt() {
    val fence = NativeSyntheticCallbackDenialFence()
    fence.enterForeground()
    val old = fence.begin(read, true, true).receipt
    assertNotNull(old)
    fence.enterForeground() // duplicate must NOT mint another pending attempt
    assertEquals(NativeSyntheticOperationAttemptFence.Decision.HOLD_REPLAYED_ATTEMPT,
      fence.begin(write, true, true).preflight)
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_NO_PENDING_CALLBACK,
      fence.observeUntrustedCallback(old, read, true))
    fence.destroy()
    fence.enterForeground()
    assertEquals(NativeSyntheticCallbackDenialFence.Decision.HOLD_SESSION_REVOKED,
      fence.observeUntrustedCallback(old, read, true))
    assertNull(fence.begin(read, true, true).receipt)
  }
}
