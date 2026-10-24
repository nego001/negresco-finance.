package com.negresco.finance.sqlcipher.lab

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.negresco.finance.security.SqlCipherLabGuard
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Separate, synthetic-only Keystore envelope for a SQLCipher passphrase.
 *
 * IMPORTANT: this lab key does NOT require biometric authentication.
 * Production needs hardware-backed capability checks, CryptoObject/lifecycle
 * authorization and a separately reviewed key rotation/recovery protocol.
 *
 * This helper deliberately never writes the wrapped secret to disk, provisions
 * during unwrap, exports Keystore key material, or touches the installed APK.
 */
internal object SyntheticSqlCipherKeyWrap {
  private const val PROVIDER = "AndroidKeyStore"
  private const val ALIAS = "negresco_sqlcipher_wrap_disposable_lab_v1"
  private val MAGIC = byteArrayOf(0x4e, 0x53, 0x4b, 0x57, 0x01) // NSKW version 1
  private val DOMAIN = "negresco.finance.sqlcipher.passphrase.wrap.v1"
    .toByteArray(Charsets.US_ASCII)
  private const val NONCE_BYTES = 12
  private const val TAG_BYTES = 16

  internal class Unavailable : IllegalStateException("Synthetic wrapped SQLCipher key unavailable")

  private fun existingKey(): SecretKey {
    val store = KeyStore.getInstance(PROVIDER).apply { load(null) }
    return store.getKey(ALIAS, null) as? SecretKey ?: throw Unavailable()
  }

  /** Only explicit test setup may provision an in-device disposable key. */
  fun provisionForSyntheticLabOnly(): Boolean {
    val store = KeyStore.getInstance(PROVIDER).apply { load(null) }
    if (store.containsAlias(ALIAS)) return false
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER)
    generator.init(
      KeyGenParameterSpec.Builder(ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setKeySize(256)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .build()
    )
    generator.generateKey()
    return true
  }

  /** The caller owns the original byte array and must erase it separately. */
  fun wrapSyntheticPassphrase(passphrase: ByteArray): ByteArray {
    SqlCipherLabGuard.validateSyntheticPassphrase(passphrase)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, existingKey())
    val nonce = cipher.iv
    if (nonce == null || nonce.size != NONCE_BYTES) throw Unavailable()
    cipher.updateAAD(DOMAIN)
    val encrypted = cipher.doFinal(passphrase)
    if (encrypted.size != SqlCipherLabGuard.SYNTHETIC_PASSPHRASE_BYTES + TAG_BYTES)
      throw Unavailable()
    return MAGIC + nonce + encrypted
  }

  /**
   * Strict, fixed-size envelope: malformed input, wrong key, and tag failure
   * cannot unlock the database or cause implicit key regeneration.
   */
  fun unwrapSyntheticPassphrase(envelope: ByteArray): ByteArray {
    val required = MAGIC.size + NONCE_BYTES +
      SqlCipherLabGuard.SYNTHETIC_PASSPHRASE_BYTES + TAG_BYTES
    if (envelope.size != required ||
        !MAGIC.indices.all { envelope[it] == MAGIC[it] }) throw Unavailable()
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      val nonce = envelope.copyOfRange(MAGIC.size, MAGIC.size + NONCE_BYTES)
      cipher.init(Cipher.DECRYPT_MODE, existingKey(), GCMParameterSpec(128, nonce))
      cipher.updateAAD(DOMAIN)
      val result = cipher.doFinal(envelope.copyOfRange(MAGIC.size + NONCE_BYTES, required))
      SqlCipherLabGuard.validateSyntheticPassphrase(result)
      return result
    } catch (_: Exception) {
      throw Unavailable()
    }
  }
}
