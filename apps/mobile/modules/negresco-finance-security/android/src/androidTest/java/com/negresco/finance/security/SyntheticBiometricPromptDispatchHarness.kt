package com.negresco.finance.security

import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import java.security.GeneralSecurityException
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec

/**
 * Phase 1 native-only BiometricPrompt dispatch harness.
 *
 * TEST PACKAGE ONLY: src/androidTest (not part of APK-facing module).
 * This is the code path to be exercised with an enrolled strong biometric
 * and REAL OS consent in a separate physical-device QA session. Automated
 * emulator tests MUST NOT fabricate AuthenticationResult/success.
 *
 * It never stores finance data, exports a key to JavaScript, grants a session,
 * or writes SQLCipher. The only successful observation is a decrypted byte
 * array in the instrumented native process, immediately zeroed by the caller.
 */
internal class SyntheticBiometricPromptDispatchHarness(
  private val lifecycle: NativeLockLifecycleFence = NativeLockLifecycleFence()
) {
  internal enum class Observation {
    DENY_BAD_KEY,
    DENY_NOT_FOREGROUND,
    DENY_REPLAY_OR_STALE,
    DENY_CALLBACK_MISMATCH,
    HOLD_NOT_ENROLLED_OR_UNAVAILABLE,
    HOLD_CANCELLED_OR_ERROR,
    HOLD_OS_AUTH_REQUIRED,
    OBSERVED_NATIVE_CRYPTO_ONLY_NOT_FINANCIAL_PERMISSION
  }

  private class Attempt(
    val expectedCipher: Cipher,
    val epoch: Long,
    val ciphertext: ByteArray,
    val aad: ByteArray,
    val onObservation: (Observation) -> Unit
  ) {
    var consumed = false
  }

  private var active: Attempt? = null

  fun foreground() { synchronized(this) { lifecycle.onForeground() } }

  fun revoke() {
    val old: Attempt?
    synchronized(this) {
      lifecycle.onBackground()
      old = active
      active = null
      old?.consumed = true
    }
    old?.onObservation?.invoke(Observation.DENY_REPLAY_OR_STALE)
  }

  fun destroy() {
    revoke()
    lifecycle.onDestroyed()
  }

  private fun validStrongPerUseKey(key: SecretKey): Boolean = try {
    val spec = SecretKeyFactory.getInstance("AES", "AndroidKeyStore")
      .getKeySpec(key, KeyInfo::class.java) as KeyInfo
    spec.isUserAuthenticationRequired &&
      spec.userAuthenticationValidityDurationSeconds == -1
  } catch (_: GeneralSecurityException) {
    false
  } catch (_: RuntimeException) {
    false
  }

  internal fun buildPrompt(): BiometricPrompt.PromptInfo =
    BiometricPrompt.PromptInfo.Builder()
      .setTitle("Negresco Finance: teste de autenticação nativa")
      .setSubtitle("Somente dados fictícios; nenhuma operação financeira será autorizada")
      .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
      .setNegativeButtonText("Cancelar")
      .build()

  /**
   * Real biometric-positive dispatch entry. DO NOT invoke in unattended CI.
   *
   * Caller must provide a FragmentActivity with a valid foreground lifecycle,
   * a real AndroidKeyStore per-use biometric key, and a synthetic ciphertext
   * produced beforehand. No fake callback is accepted as authorization:
   * Cipher.doFinal enforces the OS-approved operation.
   *
   * No return of plaintext/key/cipher to the Expo bridge.
   */
  fun requestWithRealOperatingSystemPrompt(
    activity: FragmentActivity,
    key: SecretKey,
    nonce: ByteArray,
    ciphertext: ByteArray,
    aad: ByteArray,
    onObservation: (Observation) -> Unit
  ) {
    if (!validStrongPerUseKey(key)) {
      onObservation(Observation.DENY_BAD_KEY)
      return
    }
    if (nonce.size != 12 || ciphertext.size < 16 || aad.isEmpty()) {
      onObservation(Observation.DENY_BAD_KEY)
      return
    }
    if (BiometricManager.from(activity).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG) !=
      BiometricManager.BIOMETRIC_SUCCESS) {
      onObservation(Observation.HOLD_NOT_ENROLLED_OR_UNAVAILABLE)
      return
    }
    val cipher = try {
      Cipher.getInstance("AES/GCM/NoPadding").also {
        it.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, nonce))
        it.updateAAD(aad)
      }
    } catch (_: GeneralSecurityException) {
      onObservation(Observation.HOLD_OS_AUTH_REQUIRED)
      return
    } catch (_: RuntimeException) {
      onObservation(Observation.HOLD_OS_AUTH_REQUIRED)
      return
    }

    val attempt: Attempt
    synchronized(this) {
      val epoch = lifecycle.beginDiagnosticEpoch()
      if (epoch == null || active != null) {
        onObservation(Observation.DENY_NOT_FOREGROUND)
        return
      }
      attempt = Attempt(cipher, epoch, ciphertext.copyOf(), aad.copyOf(), onObservation)
      active = attempt
    }

    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        finishAsDenial(attempt, Observation.HOLD_CANCELLED_OR_ERROR)
      }
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        completeAfterRealOsCallback(attempt, result.cryptoObject?.cipher)
      }
      override fun onAuthenticationFailed() {
        // BiometricPrompt may continue after a failed read. Never grant a
        // key or session; cancellation/error or lifecycle revoke is final.
      }
    }

    try {
      val prompt = BiometricPrompt(activity, activity.mainExecutor, callback)
      prompt.authenticate(buildPrompt(), BiometricPrompt.CryptoObject(cipher))
    } catch (_: RuntimeException) {
      finishAsDenial(attempt, Observation.HOLD_CANCELLED_OR_ERROR)
    }
  }

  @Synchronized private fun finishAsDenial(attempt: Attempt, reason: Observation) {
    if (active !== attempt || attempt.consumed) return
    attempt.consumed = true
    active = null
    attempt.ciphertext.fill(0)
    attempt.aad.fill(0)
    attempt.onObservation(reason)
  }

  private fun completeAfterRealOsCallback(attempt: Attempt, returned: Cipher?) {
    val verdict: Observation
    synchronized(this) {
      verdict = when {
        active !== attempt || attempt.consumed -> Observation.DENY_REPLAY_OR_STALE
        !lifecycle.isStillDiagnosticEpoch(attempt.epoch) ->
          Observation.DENY_REPLAY_OR_STALE
        returned !== attempt.expectedCipher -> Observation.DENY_CALLBACK_MISMATCH
        else -> {
          try {
            val plaintext = attempt.expectedCipher.doFinal(attempt.ciphertext)
            try {
              Observation.OBSERVED_NATIVE_CRYPTO_ONLY_NOT_FINANCIAL_PERMISSION
            } finally {
              plaintext.fill(0)
            }
          } catch (_: GeneralSecurityException) {
            Observation.HOLD_OS_AUTH_REQUIRED
          } catch (_: RuntimeException) {
            Observation.HOLD_OS_AUTH_REQUIRED
          }
        }
      }
      attempt.consumed = true
      if (active === attempt) active = null
      attempt.ciphertext.fill(0)
      attempt.aad.fill(0)
    }
    attempt.onObservation(verdict)
  }
}
