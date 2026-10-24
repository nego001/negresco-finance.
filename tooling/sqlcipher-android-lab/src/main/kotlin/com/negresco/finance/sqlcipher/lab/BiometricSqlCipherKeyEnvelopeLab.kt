package com.negresco.finance.sqlcipher.lab

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import com.negresco.finance.security.SqlCipherLabGuard
import java.util.concurrent.CancellationException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * In-memory SQLCipher passphrase envelope for disposable synthetic tests only.
 * No plaintext fallback, implicit key provisioning, persistent file or Expo API.
 * Each encrypt/decrypt needs the exact Cipher authenticated by CryptoObject.
 */
internal object BiometricSqlCipherKeyEnvelopeLab {
  private val MAGIC = byteArrayOf(0x4e, 0x42, 0x4b, 0x57, 0x01)
  private val DOMAIN = "negresco.finance.sqlcipher.biometric-envelope.lab.v1"
    .toByteArray(Charsets.US_ASCII)
  private const val IV_BYTES = 12
  private const val TAG_BYTES = 16
  internal class Unavailable : IllegalStateException("Synthetic biometric envelope unavailable")

  /** Reject bad length/version before asking for a biometric scan. */
  fun validateEnvelopeForLabOnly(envelope: ByteArray) {
    val length = MAGIC.size + IV_BYTES +
      SqlCipherLabGuard.SYNTHETIC_PASSPHRASE_BYTES + TAG_BYTES
    if (envelope.size != length ||
      !MAGIC.indices.all { envelope[it] == MAGIC[it] }) throw Unavailable()
  }

  suspend fun wrapForLabOnly(activity: FragmentActivity, passphrase: ByteArray): ByteArray =
    withContext(Dispatchers.Main.immediate) {
      SqlCipherLabGuard.validateSyntheticPassphrase(passphrase)
      val temporary = passphrase.copyOf()
      try {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, BiometricCipherAuthorizationLab.existingKey())
        val iv = cipher.iv ?: throw Unavailable()
        if (iv.size != IV_BYTES) throw Unavailable()
        val approved = BiometricCipherAuthorizationLab.authorize(activity, cipher)
        if (!activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
          throw Unavailable()
        approved.updateAAD(DOMAIN)
        val result = approved.doFinal(temporary)
        if (result.size != temporary.size + TAG_BYTES) throw Unavailable()
        MAGIC + iv + result
      } catch (c: CancellationException) {
        throw c
      } catch (_: Exception) {
        throw Unavailable()
      } finally {
        temporary.fill(0)
      }
    }

  suspend fun unwrapForLabOnly(activity: FragmentActivity, envelope: ByteArray): ByteArray =
    withContext(Dispatchers.Main.immediate) {
      validateEnvelopeForLabOnly(envelope)
      var recovered: ByteArray? = null
      try {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val iv = envelope.copyOfRange(MAGIC.size, MAGIC.size + IV_BYTES)
        cipher.init(Cipher.DECRYPT_MODE, BiometricCipherAuthorizationLab.existingKey(),
          GCMParameterSpec(TAG_BYTES * 8, iv))
        val approved = BiometricCipherAuthorizationLab.authorize(activity, cipher)
        if (!activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
          throw Unavailable()
        approved.updateAAD(DOMAIN)
        recovered = approved.doFinal(envelope.copyOfRange(MAGIC.size + IV_BYTES, envelope.size))
        SqlCipherLabGuard.validateSyntheticPassphrase(recovered)
        recovered
      } catch (c: CancellationException) {
        recovered?.fill(0)
        throw c
      } catch (_: Exception) {
        recovered?.fill(0)
        throw Unavailable()
      }
    }
}
