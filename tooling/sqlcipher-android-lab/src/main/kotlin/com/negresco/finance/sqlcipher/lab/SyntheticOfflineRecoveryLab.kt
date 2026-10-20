package com.negresco.finance.sqlcipher.lab

import com.negresco.finance.security.SqlCipherLabGuard
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Disposable, IN-MEMORY prototype of an INDEPENDENT offline recovery route.
 *
 * A CSPRNG-generated 256-bit recovery secret wraps a synthetic 32-byte
 * SQLCipher passphrase. No AndroidKeyStore alias, biometrics, backend or
 * JavaScript access. Nothing is written to disk or exported to the user.
 *
 * This is NOT a recovery product: key custody, secure one-time handoff, backup
 * consistency, anti-rollback, identity binding and lost-device procedures
 * require a separate threat model and audit before any integration.
 */
internal object SyntheticOfflineRecoveryLab {
  private val MAGIC = byteArrayOf(0x4e, 0x46, 0x52, 0x43, 0x01) // NFRC v1
  private val DOMAIN = "negresco.finance.offline-recovery.synthetic.v1"
    .toByteArray(Charsets.US_ASCII)
  private const val SECRET_BYTES = 32
  private const val DATABASE_ID_BYTES = 16
  private const val NONCE_BYTES = 12
  private const val TAG_BYTES = 16
  private const val ENVELOPE_BYTES =
    5 + DATABASE_ID_BYTES + NONCE_BYTES + SECRET_BYTES + TAG_BYTES

  internal class Unavailable : IllegalStateException("Synthetic recovery unavailable")

  /** Caller owns and must erase the recovery secret after the experiment. */
  internal class Kit(
    val envelope: ByteArray,
    val recoverySecret: ByteArray,
    val databaseId: ByteArray
  )

  /** Explicit creation only; NEVER invoked by an open, read or failure path. */
  fun createFreshSyntheticKit(passphrase: ByteArray): Kit {
    try {
      SqlCipherLabGuard.validateSyntheticPassphrase(passphrase)
    } catch (_: IllegalArgumentException) {
      throw Unavailable()
    }
    val random = SecureRandom()
    val recoverySecret = ByteArray(SECRET_BYTES).also { random.nextBytes(it) }
    val databaseId = ByteArray(DATABASE_ID_BYTES).also { random.nextBytes(it) }
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(recoverySecret, "AES"))
      val nonce = cipher.iv ?: throw Unavailable()
      if (nonce.size != NONCE_BYTES) throw Unavailable()
      cipher.updateAAD(DOMAIN)
      cipher.updateAAD(MAGIC)
      cipher.updateAAD(databaseId)
      val encrypted = cipher.doFinal(passphrase)
      if (encrypted.size != SECRET_BYTES + TAG_BYTES) throw Unavailable()
      return Kit(MAGIC + databaseId + nonce + encrypted, recoverySecret, databaseId)
    } catch (_: Exception) {
      recoverySecret.fill(0)
      throw Unavailable()
    }
  }

  /**
   * Envelope identity MUST match the caller's authenticated database identity.
   * A correctly formed envelope is not sufficient authorization on its own.
   * A missing/wrong key never provisions or deletes any state.
   */
  fun recoverSyntheticPassphrase(
    envelope: ByteArray, recoverySecret: ByteArray, expectedDatabaseId: ByteArray
  ): ByteArray {
    if (envelope.size != ENVELOPE_BYTES ||
      recoverySecret.size != SECRET_BYTES ||
      expectedDatabaseId.size != DATABASE_ID_BYTES ||
      !MessageDigest.isEqual(envelope.copyOfRange(0, MAGIC.size), MAGIC) ||
      !MessageDigest.isEqual(
        envelope.copyOfRange(MAGIC.size, MAGIC.size + DATABASE_ID_BYTES),
        expectedDatabaseId
      )) throw Unavailable()

    var plaintext: ByteArray? = null
    try {
      val nonceStart = MAGIC.size + DATABASE_ID_BYTES
      val nonce = envelope.copyOfRange(nonceStart, nonceStart + NONCE_BYTES)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(recoverySecret, "AES"),
        GCMParameterSpec(TAG_BYTES * 8, nonce))
      cipher.updateAAD(DOMAIN)
      cipher.updateAAD(MAGIC)
      cipher.updateAAD(expectedDatabaseId)
      plaintext = cipher.doFinal(envelope.copyOfRange(nonceStart + NONCE_BYTES, envelope.size))
      SqlCipherLabGuard.validateSyntheticPassphrase(plaintext)
      return plaintext
    } catch (_: Exception) {
      plaintext?.fill(0)
      throw Unavailable()
    }
  }
}
