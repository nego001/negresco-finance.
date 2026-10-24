package com.negresco.finance.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Isolated lab-only Keystore key for the synthetic AES-256-GCM record envelope.
 *
 * NOT a production vault root, SQLCipher page key, an E2EE recovery key, or a
 * biometric CryptoObject. Never call these APIs for real financial records.
 * No Expo bridge, UI registration, data export or APK integration exists.
 *
 * This lab key intentionally has no user-authentication requirement so that
 * ONLY the cryptographic round-trip can be inspected. Production must bind
 * key use to native biometrics and a separately reviewed lifecycle protocol.
 */
internal object AndroidKeystoreFinancialEnvelopeLab {
  private const val PROVIDER = "AndroidKeyStore"
  private const val KEY_ALIAS = "negresco.lab.only.aead.financial.v1"
  private const val KEY_ID = "lab-financial-aead-v1"

  private fun existingKey(): SecretKey {
    val store = KeyStore.getInstance(PROVIDER).apply { load(null) }
    return store.getKey(KEY_ALIAS, null) as? SecretKey
      ?: throw FinancialEnvelopeKeyUnavailable()
  }

  /** Explicit provisioning of a NON-BIOMETRIC key for disposable test data. */
  suspend fun provisionForSyntheticLabOnly(): Boolean = withContext(Dispatchers.IO) {
    synchronized(this@AndroidKeystoreFinancialEnvelopeLab) {
      val store = KeyStore.getInstance(PROVIDER).apply { load(null) }
      if (store.containsAlias(KEY_ALIAS)) return@synchronized false

      val parameters = KeyGenParameterSpec.Builder(
        KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
      )
        .setKeySize(256)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .build()

      KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER).apply {
        init(parameters)
        generateKey()
      }
      true
    }
  }

  suspend fun encryptDisposableRecordForLab(
    syntheticBytes: ByteArray,
    context: FinancialRecordContext
  ): ByteArray = withContext(Dispatchers.IO) {
    FinancialRecordEnvelopeV1.encrypt(syntheticBytes, context, KEY_ID, existingKey())
  }

  suspend fun decryptDisposableRecordForLab(
    envelope: ByteArray,
    expected: FinancialRecordContext
  ): ByteArray = withContext(Dispatchers.IO) {
    // No key generation during decrypt. Lost key means failed decryption.
    FinancialRecordEnvelopeV1.decrypt(envelope, expected, FinancialKeyResolver { id ->
      if (id == KEY_ID) existingKey() else null
    })
  }
}
