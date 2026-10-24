package com.negresco.finance.security

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.nio.charset.StandardCharsets
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Experimental AES-256-GCM financial-record envelope. JVM-testable, no Expo
 * bridge, no SQLCipher, no real user data and no promise of zero-knowledge.
 *
 * This is a RECORD envelope, not a database/page-encryption implementation.
 * External context is authenticated (type, logical ID, revision); callers
 * MUST obtain the expected revision from an independently trusted source.
 * Replay of an old valid envelope with its old context still succeeds.
 */
internal data class FinancialRecordContext(
  val type: String,
  val logicalId: String,
  val revision: Long
)

internal fun interface FinancialKeyResolver {
  /** Return an already-authorized, existing key. Never provision on read. */
  fun resolve(keyId: String): SecretKey?
}

internal class FinancialEnvelopeInvalid : IllegalStateException("Invalid or unauthenticated financial envelope")
internal class FinancialEnvelopeKeyUnavailable : IllegalStateException("Financial envelope key unavailable")

internal object FinancialRecordEnvelopeV1 {
  private const val MAGIC = 0x4E465231 // "NFR1"
  private const val VERSION = 1
  private const val NONCE_SIZE = 12
  private const val TAG_SIZE = 16
  private const val MAX_PLAINTEXT = 1024 * 1024 // Synthetic records only; bounded parsing
  private const val MAX_KEY_ID_BYTES = 64
  private val DOMAIN = "negresco.finance.record.aead.v1".toByteArray(StandardCharsets.US_ASCII)
  private val IDENTIFIER = Regex("[a-zA-Z0-9._:-]{1,128}")
  private val KEY_ID = Regex("[a-zA-Z0-9._:-]{1,64}")

  private data class Parsed(val keyId: String, val nonce: ByteArray, val ciphertext: ByteArray)

  private fun validate(context: FinancialRecordContext) {
    require(context.revision >= 0L && context.type.matches(IDENTIFIER) &&
      context.logicalId.matches(IDENTIFIER)) { "Invalid financial record context" }
  }

  private fun checkKey(key: SecretKey) {
    require(key.algorithm.equals("AES", ignoreCase = true)) { "AES key required" }
    // AndroidKeyStore nonexportable key returns null; its 256-bit size must be
    // verified at provisioning/attestation. Raw JVM keys must be exactly 256 bit.
    val encoded = key.encoded
    if (encoded != null) require(encoded.size == 32) { "AES-256 key required" }
  }

  private fun writeUtf8(out: DataOutputStream, text: String) {
    val bytes = text.toByteArray(StandardCharsets.UTF_8)
    out.writeShort(bytes.size)
    out.write(bytes)
  }

  private fun aad(keyId: String, context: FinancialRecordContext): ByteArray {
    validate(context)
    require(keyId.matches(KEY_ID)) { "Invalid key ID" }
    val bytes = ByteArrayOutputStream()
    DataOutputStream(bytes).use { out ->
      out.writeInt(DOMAIN.size)
      out.write(DOMAIN)
      out.writeInt(VERSION)
      writeUtf8(out, keyId)
      writeUtf8(out, context.type)
      writeUtf8(out, context.logicalId)
      out.writeLong(context.revision)
    }
    return bytes.toByteArray()
  }

  /**
   * Cipher provider selects a fresh random IV on EVERY encryption. Never
   * supply a caller-selected nonce or reuse the same IV under a given key.
   */
  fun encrypt(
    plaintext: ByteArray,
    context: FinancialRecordContext,
    keyId: String,
    key: SecretKey
  ): ByteArray {
    require(plaintext.size <= MAX_PLAINTEXT) { "Record too large" }
    checkKey(key)
    val associated = aad(keyId, context)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key)
    val nonce = cipher.iv ?: error("GCM provider did not generate an IV")
    check(nonce.size == NONCE_SIZE) { "Expected a 96-bit GCM nonce" }
    cipher.updateAAD(associated)
    val ciphertext = cipher.doFinal(plaintext)
    check(ciphertext.size == plaintext.size + TAG_SIZE)

    val out = ByteArrayOutputStream()
    DataOutputStream(out).use { data ->
      data.writeInt(MAGIC)
      data.writeInt(VERSION)
      writeUtf8(data, keyId)
      data.writeByte(nonce.size)
      data.write(nonce)
      data.writeInt(ciphertext.size)
      data.write(ciphertext)
    }
    return out.toByteArray()
  }

  private fun parse(bytes: ByteArray): Parsed {
    try {
      val input = DataInputStream(ByteArrayInputStream(bytes))
      if (input.readInt() != MAGIC || input.readInt() != VERSION)
        throw FinancialEnvelopeInvalid()
      val keyLen = input.readUnsignedShort()
      if (keyLen !in 1..MAX_KEY_ID_BYTES) throw FinancialEnvelopeInvalid()
      val keyBytes = ByteArray(keyLen)
      input.readFully(keyBytes)
      val keyId = String(keyBytes, StandardCharsets.US_ASCII)
      if (!keyId.matches(KEY_ID) ||
          !keyId.toByteArray(StandardCharsets.US_ASCII).contentEquals(keyBytes))
        throw FinancialEnvelopeInvalid()
      if (input.readUnsignedByte() != NONCE_SIZE) throw FinancialEnvelopeInvalid()
      val nonce = ByteArray(NONCE_SIZE)
      input.readFully(nonce)
      val length = input.readInt()
      if (length < TAG_SIZE || length > MAX_PLAINTEXT + TAG_SIZE ||
          input.available() != length) throw FinancialEnvelopeInvalid()
      val ciphertext = ByteArray(length)
      input.readFully(ciphertext)
      if (input.available() != 0) throw FinancialEnvelopeInvalid()
      return Parsed(keyId, nonce, ciphertext)
    } catch (_: Exception) {
      throw FinancialEnvelopeInvalid()
    }
  }

  /**
   * No plaintext fallback. Invalid context/ciphertext, missing key and wrong
   * authentication tags never return recovered or partially decrypted bytes.
   */
  fun decrypt(
    envelope: ByteArray,
    expected: FinancialRecordContext,
    resolver: FinancialKeyResolver
  ): ByteArray {
    val parsed = parse(envelope)
    val associated = try { aad(parsed.keyId, expected) }
      catch (_: IllegalArgumentException) { throw FinancialEnvelopeInvalid() }
    val key = try { resolver.resolve(parsed.keyId) }
      catch (_: Exception) { throw FinancialEnvelopeKeyUnavailable() }
      ?: throw FinancialEnvelopeKeyUnavailable()
    try {
      checkKey(key)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_SIZE * 8, parsed.nonce))
      cipher.updateAAD(associated)
      return cipher.doFinal(parsed.ciphertext)
    } catch (_: Exception) {
      throw FinancialEnvelopeInvalid()
    }
  }
}
