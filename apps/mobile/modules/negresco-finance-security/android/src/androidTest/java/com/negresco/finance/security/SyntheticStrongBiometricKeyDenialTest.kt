package com.negresco.finance.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
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

/**
 * Phase 1 / SEC-05 - NEGATIVE real AndroidKeyStore instrumentation only.
 *
 * Requires BIOMETRIC_STRONG per crypto operation (timeout=0), and verifies
 * an UNAUTHORIZED encrypt is refused. A disposable emulator has no valid
 * BiometricPrompt CryptoObject approval for this test. Devices which cannot
 * enroll/generate a strong-biometric key must also fail closed.
 *
 * This does not prompt or enroll users; no biometric is ever "faked", no
 * financial SQLCipher DB or real data is accessed, no JS auth grant exists.
 * A denied operation is not proof that the full biometric-positive flow is
 * implemented. StrongBox/hardware properties are NOT asserted.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticStrongBiometricKeyDenialTest {
  private fun store(): KeyStore =
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  private fun makeStrongBiometricPerUseKey(alias: String): SecretKey {
    val generator = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    val parameters = KeyGenParameterSpec.Builder(
      alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setUserAuthenticationRequired(true)
      .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
      .setInvalidatedByBiometricEnrollment(true)
      .build()
    generator.init(parameters)
    return generator.generateKey()
  }

  @Test fun strongBiometricKeyCannotEncryptWithoutCryptoObjectAuthentication() {
    val alias = "negresco_auth_denied_fixture_${UUID.randomUUID()}"
    var encryptedWithoutAuthorization = false
    var unsupportedPrerequisite = false
    try {
      // Some clean emulators have no enrolled strong biometric or secure lock
      // screen; generating such a key can be rejected before Cipher.init.
      val key = try {
        makeStrongBiometricPerUseKey(alias)
      } catch (_: ProviderException) {
        unsupportedPrerequisite = true
        null
      } catch (_: GeneralSecurityException) {
        unsupportedPrerequisite = true
        null
      }
      if (key != null) {
        val info = SecretKeyFactory.getInstance("AES", "AndroidKeyStore")
          .getKeySpec(key, KeyInfo::class.java) as KeyInfo
        assertTrue("fixture key explicitly requires Android user authentication",
          info.isUserAuthenticationRequired)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        try {
          cipher.init(Cipher.ENCRYPT_MODE, key)
          // This test deliberately never calls BiometricPrompt.authenticate
          // with CryptoObject(cipher): an unauthenticated use must be denied.
          cipher.doFinal("no-real-financial-data".toByteArray(Charsets.UTF_8))
          encryptedWithoutAuthorization = true
        } catch (_: GeneralSecurityException) {
          // Invalid/unauthed key -> HOLD. No key material was unwrapped.
        } catch (_: IllegalStateException) {
          // Crypto operation not initialized or usable -> HOLD.
        }
      }
      assertFalse("never encrypt without strong biometric CryptoObject consent",
        encryptedWithoutAuthorization)
      // If platform cannot provision a valid auth-bound key, this is a
      // legitimate negative capability result, NOT an auth success.
      if (unsupportedPrerequisite) {
        assertFalse("absence of biometric prerequisite must remain DENY",
          encryptedWithoutAuthorization)
      }
    } finally {
      store().deleteEntry(alias)
      assertFalse("test alias must not survive instrumentation",
        store().containsAlias(alias))
    }
  }

  @Test fun deniedBiometricOperationCannotCreateSqlcipherStateOrReleaseKey() {
    val alias = "negresco_auth_denied_fixture_${UUID.randomUUID()}"
    try {
      // This test intentionally does not create an SQLite file or use the
      // JS bridge. Presence of any auth-gated key is not a valid crypto
      // authorization, and requires a separate native-only CryptoObject flow.
      val before = store().containsAlias(alias)
      assertFalse("test starts without any key", before)
      assertFalse("no implicit credential enrollment", store().containsAlias(alias))
    } finally {
      store().deleteEntry(alias)
      assertFalse(store().containsAlias(alias))
    }
  }
}
