package com.negresco.finance.sqlcipher.lab

import javax.crypto.Cipher

/**
 * One-operation, one-use CryptoObject decision gate for disposable tests.
 *
 * This state is NEVER a login credential or a substitute for KeyStore's
 * per-use biometric authorization. It only rejects stale, repeated, missing,
 * mismatched or backgrounded UI callbacks before calling Cipher.doFinal.
 */
internal class BiometricOperationGate(private val expected: Cipher) {
  private enum class State { WAITING, APPROVED, CLOSED }
  private var state = State.WAITING

  /** Called only from BiometricPrompt.onAuthenticationSucceeded. */
  fun approve(returned: Cipher?, resumed: Boolean): Boolean {
    if (state != State.WAITING) return false
    if (!resumed || returned !== expected) {
      state = State.CLOSED
      return false
    }
    state = State.APPROVED
    return true
  }

  /** Called on cancellation, error, Activity.onStop or failed authorization. */
  fun revoke() {
    state = State.CLOSED
  }

  /**
   * The approved instance can be claimed only once while the Activity is
   * resumed. A second claim never returns an authorized Cipher.
   */
  fun consume(resumed: Boolean): Cipher? {
    if (state != State.APPROVED || !resumed) {
      state = State.CLOSED
      return null
    }
    state = State.CLOSED
    return expected
  }
}
