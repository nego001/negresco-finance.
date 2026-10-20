package com.negresco.finance.sqlcipher.lab

import androidx.test.ext.junit.runners.AndroidJUnit4
import javax.crypto.Cipher
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Deliberately uses UNINITIALIZED disposable Cipher objects. These tests
 * exercise only fail-closed callback authorization rules, never biometric
 * enrollment, physical sensor behavior, SQLCipher, or real user keys.
 */
@RunWith(AndroidJUnit4::class)
class BiometricOperationGateInstrumentedTest {
  private fun cipher(): Cipher = Cipher.getInstance("AES/GCM/NoPadding")

  @Test fun noSuccessfulCallbackNeverAuthorizes() {
    val gate = BiometricOperationGate(cipher())
    assertNull(gate.consume(resumed = true))
  }

  @Test fun matchingCryptoObjectCanBeConsumedOnlyOnce() {
    val expected = cipher()
    val gate = BiometricOperationGate(expected)
    assertTrue(gate.approve(expected, resumed = true))
    assertSame(expected, gate.consume(resumed = true))
    assertNull(gate.consume(resumed = true))
    assertFalse(gate.approve(expected, resumed = true))
  }

  @Test fun otherCipherCannotBeSubstitutedForApprovedCryptoObject() {
    val expected = cipher()
    val gate = BiometricOperationGate(expected)
    assertFalse(gate.approve(cipher(), resumed = true))
    assertFalse(gate.approve(expected, resumed = true))
    assertNull(gate.consume(resumed = true))
  }

  @Test fun missingCryptoObjectFailsClosed() {
    val expected = cipher()
    val gate = BiometricOperationGate(expected)
    assertFalse(gate.approve(null, resumed = true))
    assertNull(gate.consume(resumed = true))
  }

  @Test fun approvalArrivingAfterBackgroundNeverAuthorizes() {
    val expected = cipher()
    val gate = BiometricOperationGate(expected)
    assertFalse(gate.approve(expected, resumed = false))
    assertNull(gate.consume(resumed = true))
  }

  @Test fun backgroundAfterSuccessRevokesBeforeCipherCanBeUsed() {
    val expected = cipher()
    val gate = BiometricOperationGate(expected)
    assertTrue(gate.approve(expected, resumed = true))
    assertNull(gate.consume(resumed = false))
    assertNull(gate.consume(resumed = true))
  }

  @Test fun cancellationRejectsEvenLateSuccessCallback() {
    val expected = cipher()
    val gate = BiometricOperationGate(expected)
    gate.revoke()
    assertFalse(gate.approve(expected, resumed = true))
    assertNull(gate.consume(resumed = true))
  }

  @Test fun repeatedCallbacksCannotReuseACompletedAuthorization() {
    val expected = cipher()
    val gate = BiometricOperationGate(expected)
    assertTrue(gate.approve(expected, resumed = true))
    assertFalse(gate.approve(expected, resumed = true))
    assertSame(expected, gate.consume(resumed = true))
    assertNull(gate.consume(resumed = true))
  }
}
