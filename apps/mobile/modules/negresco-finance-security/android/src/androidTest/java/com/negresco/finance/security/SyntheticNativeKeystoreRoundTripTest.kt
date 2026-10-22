package com.negresco.finance.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.util.UUID
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Android emulator instrumentation, NOT app feature, NOT a persistent vault.
 *
 * Test-only AndroidKeyStore AES/GCM/NoPadding for synthetic bytes. Does NOT
 * request authentication, authorize a financial operation, use SQLCipher or
 * claim hardware backing/StrongBox/anti-rollback. The alias is random and
 * ALWAYS removed in finally. Never prints keys, IV, plaintext or ciphertext.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticNativeKeystoreRoundTripTest {
  private fun keystore(): KeyStore =
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  private fun createKey(alias: String): SecretKey {
    val generator = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    val spec = KeyGenParameterSpec.Builder(
      alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setUserAuthenticationRequired(false) // explicitly NOT biometric authorization
      .build()
    generator.init(spec)
    return generator.generateKey()
  }

  @Test fun ephemeralKeyRoundTripSurvivesNewCipherInstanceAndDeletesAlias() {
    val alias = "negresco_fixture_${UUID.randomUUID()}"
    val payload = "synthetic-sec05k-expo-bridge-only".toByteArray(StandardCharsets.UTF_8)
    try {
      val key = createKey(alias)
      assertTrue(keystore().containsAlias(alias))
      assertNotNull(keystore().getKey(alias, null))
      val encryption = Cipher.getInstance("AES/GCM/NoPadding")
      encryption.init(Cipher.ENCRYPT_MODE, key)
      val iv = encryption.iv.copyOf()
      val sealed = encryption.doFinal(payload)
      assertFalse(payload.contentEquals(sealed))
      val reopenedKey = keystore().getKey(alias, null) as SecretKey
      val decryption = Cipher.getInstance("AES/GCM/NoPadding")
      decryption.init(Cipher.DECRYPT_MODE, reopenedKey, GCMParameterSpec(128, iv))
      assertArrayEquals(payload, decryption.doFinal(sealed))
    } finally {
      keystore().deleteEntry(alias)
    }
    assertFalse(keystore().containsAlias(alias))
    // This only demonstrates use of AndroidKeyStore on an isolated emulator,
    // not non-exportability attestation, biometric binding or secure storage.
  }

  @Test fun modifiedCiphertextFailsAuthenticationAndEphemeralKeyIsRemoved() {
    val alias = "negresco_fixture_${UUID.randomUUID()}"
    try {
      val key = createKey(alias)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, key)
      val iv = cipher.iv.copyOf()
      val sealed = cipher.doFinal("random-test-only".toByteArray(StandardCharsets.UTF_8))
      sealed[sealed.lastIndex] = (sealed.last().toInt() xor 1).toByte()
      val decrypt = Cipher.getInstance("AES/GCM/NoPadding")
      decrypt.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
      try {
        decrypt.doFinal(sealed)
        fail("tampered AES-GCM must be refused")
      } catch (expected: AEADBadTagException) {
        // Authentication tag verified; no plaintext should be used.
      }
    } finally {
      keystore().deleteEntry(alias)
    }
    assertFalse(keystore().containsAlias(alias))
  }

  @Test fun deletedEphemeralAliasCannotBeRecoveredByReopeningKeystore() {
    val alias = "negresco_fixture_${UUID.randomUUID()}"
    try {
      createKey(alias)
      assertNotNull(keystore().getKey(alias, null))
    } finally {
      keystore().deleteEntry(alias)
    }
    assertFalse(keystore().containsAlias(alias))
    assertTrue(keystore().getKey(alias, null) == null)
  }
}
