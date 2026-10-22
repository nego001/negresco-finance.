package com.negresco.finance.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricPrompt
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.security.ProviderException
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.SecretKeySpec

/**
 * SEC-05 / Phase 1: a NEGATIVE CryptoObject boundary, androidTest only.
 *
 * BiometricPrompt.CryptoObject is only a container for a Cipher. Code can
 * construct a container WITHOUT prompting the OS; a JS flag, callback name
 * or CryptoObject reference alone must never authorize a DB transaction.
 *
 * A test-only fence validates native AndroidKeyStore KeyInfo, checks the same
 * exact Cipher instance and native foreground epoch, then relies on doFinal()
 * (hardware/Keystore OS enforcement) rather than on "success" booleans.
 * Even a successful crypto operation would be OBSERVATION_ONLY, never a
 * financial grant. This suite deliberately does not run a positive prompt,
 * release a real SQLCipher key, or create financial data.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticCryptoObjectCallbackFirewallTest {
  private enum class Verdict {
    DENY_NOT_AUTH_BOUND, DENY_BAD_OR_REPLAYED_CALLBACK,
    DENY_STALE_FOREGROUND, HOLD_KEYSTORE_UNAVAILABLE,
    HOLD_OS_AUTH_REQUIRED, OBSERVED_CRYPTO_ONLY_NOT_AUTHORIZATION
  }

  private class Attempt(
    val expectedCipher: Cipher,
    val epoch: Long
  ) {
    var consumed: Boolean = false
  }

  private class NativeFenceFixtureOnly {
    private val lifecycle = NativeLockLifecycleFence()

    fun enterForeground() = lifecycle.onForeground()
    fun leaveForeground() = lifecycle.onBackground()
    fun destroy() = lifecycle.onDestroyed()

    // The key must actually live in AndroidKeyStore, require user auth and
    // have no time-based unlock window (per-operation authentication).
    fun begin(key: SecretKey, cipher: Cipher): Attempt? {
      val info = try {
        SecretKeyFactory.getInstance("AES", "AndroidKeyStore")
          .getKeySpec(key, KeyInfo::class.java) as KeyInfo
      } catch (_: GeneralSecurityException) {
        return null
      } catch (_: IllegalArgumentException) {
        return null
      }
      if (!info.isUserAuthenticationRequired ||
          info.userAuthenticationValidityDurationSeconds != -1) return null
      val epoch = lifecycle.beginDiagnosticEpoch() ?: return null
      return Attempt(cipher, epoch)
    }

    @Synchronized fun finish(
      attempt: Attempt?, result: BiometricPrompt.CryptoObject?
    ): Verdict {
      if (attempt == null) return Verdict.DENY_NOT_AUTH_BOUND
      // Consume BEFORE any cryptographic work, including failure paths.
      if (attempt.consumed) return Verdict.DENY_BAD_OR_REPLAYED_CALLBACK
      attempt.consumed = true
      if (!lifecycle.isStillDiagnosticEpoch(attempt.epoch))
        return Verdict.DENY_STALE_FOREGROUND
      if (result?.cipher !== attempt.expectedCipher)
        return Verdict.DENY_BAD_OR_REPLAYED_CALLBACK
      return try {
        // No authentication is performed in this test. The Keystore must
        // refuse a per-use auth-bound Cipher without the genuine OS prompt.
        attempt.expectedCipher.doFinal(
          "fixture-not-financial-data".toByteArray(Charsets.UTF_8))
        Verdict.OBSERVED_CRYPTO_ONLY_NOT_AUTHORIZATION
      } catch (_: GeneralSecurityException) {
        Verdict.HOLD_OS_AUTH_REQUIRED
      } catch (_: IllegalStateException) {
        Verdict.HOLD_OS_AUTH_REQUIRED
      }
    }
  }

  private fun store(): KeyStore =
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  private fun makePerUseStrongKey(alias: String): SecretKey {
    val generator = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(KeyGenParameterSpec.Builder(
      alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setUserAuthenticationRequired(true)
      .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
      .setInvalidatedByBiometricEnrollment(true)
      .build())
    return generator.generateKey()
  }

  @Test fun fabricatedCryptoObjectCannotTurnASoftwareKeyIntoAndroidAuthorization() {
    val fence = NativeFenceFixtureOnly()
    fence.enterForeground()
    val software = SecretKeySpec(ByteArray(32) { 7 }, "AES")
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, software)
    val fabricated = BiometricPrompt.CryptoObject(cipher)
    assertNotNull(fabricated.cipher)
    // Even though a software Cipher can encrypt, a fake CryptoObject cannot
    // pass AndroidKeyStore per-use KeyInfo policy and cannot open a database.
    val attempt = fence.begin(software, cipher)
    assertNull(attempt)
    assertEquals(Verdict.DENY_NOT_AUTH_BOUND, fence.finish(attempt, fabricated))
    fence.destroy()
  }

  @Test fun callbackCannotBeAcceptedWithoutAPendingNativeAttempt() {
    val fence = NativeFenceFixtureOnly()
    fence.enterForeground()
    val uninitialized = Cipher.getInstance("AES/GCM/NoPadding")
    assertEquals(Verdict.DENY_NOT_AUTH_BOUND,
      fence.finish(null, BiometricPrompt.CryptoObject(uninitialized)))
    assertEquals(Verdict.DENY_NOT_AUTH_BOUND, fence.finish(null, null))
    fence.leaveForeground()
  }

  @Test fun missingBiometricEnrollmentCannotCreateAUsableApprovalToken() {
    val alias = "negresco_cryptoobject_fixture_${UUID.randomUUID()}"
    val fence = NativeFenceFixtureOnly()
    fence.enterForeground()
    try {
      val key: SecretKey? = try {
        makePerUseStrongKey(alias)
      } catch (_: GeneralSecurityException) {
        null
      } catch (_: ProviderException) {
        null
      }
      if (key == null) {
        assertNull("emulator cannot provision a strong biometric key", key)
        // This is an explicit UNSUPPORTED prerequisite, not successful auth.
      } else {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        var usable = true
        try {
          cipher.init(Cipher.ENCRYPT_MODE, key)
        } catch (_: GeneralSecurityException) {
          usable = false
        } catch (_: ProviderException) {
          usable = false
        }
        if (usable) {
          val attempt = fence.begin(key, cipher)
          assertNotNull("per-use biometric KeyInfo should be recognized", attempt)
          val fakeCallback = BiometricPrompt.CryptoObject(cipher)
          // Synthetic 'success' is just an object; no OS biometric approval.
          val verdict = fence.finish(attempt, fakeCallback)
          assertEquals("never accept software-fabricated callback as auth",
            Verdict.HOLD_OS_AUTH_REQUIRED, verdict)
          assertEquals("one-time native attempts reject replay",
            Verdict.DENY_BAD_OR_REPLAYED_CALLBACK, fence.finish(attempt, fakeCallback))
          // A brand-new attempt is invalid after native background; returning
          // foreground never resurrects the old token.
          val stale = fence.begin(key, cipher)
          assertNotNull(stale)
          fence.leaveForeground()
          assertEquals(Verdict.DENY_STALE_FOREGROUND, fence.finish(stale, fakeCallback))
          fence.enterForeground()
          assertEquals(Verdict.DENY_BAD_OR_REPLAYED_CALLBACK, fence.finish(stale, fakeCallback))
          // A valid key does not make a foreign CryptoObject acceptable.
          val wrong = fence.begin(key, cipher)
          assertNotNull(wrong)
          val different = BiometricPrompt.CryptoObject(Cipher.getInstance("AES/GCM/NoPadding"))
          assertEquals(Verdict.DENY_BAD_OR_REPLAYED_CALLBACK, fence.finish(wrong, different))
        }
      }
    } finally {
      store().deleteEntry(alias)
      assertFalse(store().containsAlias(alias))
      fence.destroy()
    }
  }

  @Test fun revokedForegroundEpochDoesNotManufactureAnAuthorization() {
    val fence = NativeFenceFixtureOnly()
    fence.enterForeground()
    // Without a real authenticated Keystore-backed attempt, an untrusted
    // callback cannot be consumed. Lifecycle revocation is independently
    // enforced by NativeLockLifecycleFence and has no grant operation.
    val callback = BiometricPrompt.CryptoObject(
      Cipher.getInstance("AES/GCM/NoPadding"))
    fence.leaveForeground()
    assertEquals(Verdict.DENY_NOT_AUTH_BOUND, fence.finish(null, callback))
    fence.enterForeground()
    assertEquals(Verdict.DENY_NOT_AUTH_BOUND, fence.finish(null, callback))
    fence.destroy()
  }
}
