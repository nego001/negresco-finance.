package com.negresco.finance.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * AndroidKeyStore HMAC laboratory. NOT connected to DataStore, BiometricPrompt,
 * Expo, the installed APK, or financial database encryption.
 *
 * Integrity verification NEVER creates a new key: when Keystore loses an
 * existing key, verification fails closed. The separate explicit provisioning
 * entrypoint is for disposable synthetic laboratory records ONLY.
 *
 * A signed old record remains authentic. AndroidKeyStore HMAC by itself
 * DOES NOT provide anti-rollback, transaction atomicity, or biometric gating.
 */
internal object AndroidKeystoreLockIntegrity {
  private const val KEY_ALIAS = "negresco_native_lock_integrity_lab_v1"
  private const val PROVIDER = "AndroidKeyStore"

  private fun loadKeystore(): KeyStore =
    KeyStore.getInstance(PROVIDER).apply { load(null) }

  /**
   * No implicit generation during verify/seal. This explicit operation must
   * never be called against a user's installed native lock state.
   */
  suspend fun provisionForSyntheticLabOnly(): Boolean = withContext(Dispatchers.IO) {
    synchronized(this@AndroidKeystoreLockIntegrity) {
      val keystore = loadKeystore()
      if (keystore.containsAlias(KEY_ALIAS)) return@synchronized false
      val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, PROVIDER)
      val parameters = KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
      ).setDigests(KeyProperties.DIGEST_SHA256).build()
      generator.init(parameters)
      generator.generateKey()
      true
    }
  }

  private fun existingMac(): LockRecordMac {
    val key = loadKeystore().getKey(KEY_ALIAS, null) as? SecretKey
      ?: throw IllegalStateException("AndroidKeyStore integrity key unavailable")
    return LockRecordMac { bytes ->
      // Mac instances are not safe to share across concurrent operations.
      val engine = Mac.getInstance("HmacSHA256")
      engine.init(key)
      engine.doFinal(bytes)
    }
  }

  suspend fun verifyWithExistingKey(record: LockRecord, tag: ByteArray?): LockIntegrityResult =
    withContext(Dispatchers.IO) {
      val source = try { existingMac() }
        catch (_: Exception) { return@withContext LockIntegrityResult.KEY_UNAVAILABLE }
      LockRecordIntegrity.verify(record, tag, source)
    }

  suspend fun sealSyntheticRecord(record: LockRecord): ByteArray = withContext(Dispatchers.IO) {
    // Only explicit lab provisioning may create the key.
    LockRecordIntegrity.seal(record, existingMac())
  }
}
