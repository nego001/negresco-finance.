package com.negresco.finance.security

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.UUID

/**
 * SEC-05H: fixed 184-byte portable encrypted envelope fixture.
 * No key-recovery phrase belongs in this file. SHA-256 catches accidental
 * damage, NOT malicious tampering; AES-GCM validates authenticity later.
 * Parsing never establishes owner identity or device authorization.
 */
internal enum class SyntheticPortableEnvelopeCheck {
  PARSED_ONLY_NOT_AUTHENTICATED,
  DENY_FORMAT,
  DENY_ACCOUNT,
  DENY_CHECKSUM,
  DENY_METADATA
}

internal class SyntheticPortableEnvelopeImportLab(
  val check: SyntheticPortableEnvelopeCheck,
  val envelope: SyntheticRecoveryKitEnvelopeLab? = null
) {
  override fun toString(): String = "SyntheticPortableEnvelopeImportLab($check,[redacted])"
}

internal object SyntheticPortableRecoveryEnvelopeLab {
  const val FILE_LENGTH = 184
  private const val PAYLOAD_LENGTH = 152
  private val magic = "NGFRCV01".toByteArray(Charsets.US_ASCII)
  private val accountFormat = Regex("[0-9a-f]{32}")
  private val uuidFormat = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

  private fun fromHex(text: String): ByteArray =
    text.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
  private fun toHex(bytes: ByteArray): String =
    bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
  private fun digest(bytes: ByteArray): ByteArray =
    MessageDigest.getInstance("SHA-256").digest(bytes)

  private fun wellFormed(e: SyntheticRecoveryKitEnvelopeLab): Boolean =
    accountFormat.matches(e.opaqueAccountId) &&
      uuidFormat.matches(e.kitId) &&
      runCatching { UUID.fromString(e.kitId).toString() == e.kitId }.getOrDefault(false) &&
      e.keyVersion > 0L && e.ownerGeneration > 0L &&
      e.saltCopy().size == 32 && e.nonceCopy().size == 12 &&
      e.ciphertextCopy().size == 48

  /** Writes only the encrypted envelope. An offline kit phrase is separate. */
  fun exportEnvelopeBytesFixtureOnly(e: SyntheticRecoveryKitEnvelopeLab): ByteArray {
    require(wellFormed(e)) { "Noncanonical synthetic envelope" }
    val uuid = UUID.fromString(e.kitId)
    val out = ByteBuffer.allocate(FILE_LENGTH).order(ByteOrder.BIG_ENDIAN)
    out.put(magic)
    out.putInt(1)
    out.put(fromHex(e.opaqueAccountId))
    out.putLong(uuid.mostSignificantBits)
    out.putLong(uuid.leastSignificantBits)
    out.putLong(e.keyVersion)
    out.putLong(e.ownerGeneration)
    out.put(e.saltCopy())
    out.put(e.nonceCopy())
    out.put(e.ciphertextCopy())
    check(out.position() == PAYLOAD_LENGTH)
    out.put(digest(out.array().copyOfRange(0, PAYLOAD_LENGTH)))
    check(out.position() == FILE_LENGTH)
    return out.array().copyOf()
  }

  /** Strict length + scope + checksum, without decrypting or granting access. */
  fun importEnvelopeBytesFixtureOnly(
    input: ByteArray?, expectedAccountId: String
  ): SyntheticPortableEnvelopeImportLab {
    fun rejected(status: SyntheticPortableEnvelopeCheck) =
      SyntheticPortableEnvelopeImportLab(status)
    if (input == null || input.size != FILE_LENGTH)
      return rejected(SyntheticPortableEnvelopeCheck.DENY_FORMAT)
    if (!accountFormat.matches(expectedAccountId))
      return rejected(SyntheticPortableEnvelopeCheck.DENY_ACCOUNT)
    val data = input.copyOf()
    val bytes = ByteBuffer.wrap(data).order(ByteOrder.BIG_ENDIAN)
    val header = ByteArray(8).also { bytes.get(it) }
    if (!header.contentEquals(magic) || bytes.int != 1)
      return rejected(SyntheticPortableEnvelopeCheck.DENY_FORMAT)
    val account = toHex(ByteArray(16).also { bytes.get(it) })
    if (account != expectedAccountId)
      return rejected(SyntheticPortableEnvelopeCheck.DENY_ACCOUNT)
    val id = UUID(bytes.long, bytes.long).toString()
    val version = bytes.long
    val generation = bytes.long
    val salt = ByteArray(32).also { bytes.get(it) }
    val nonce = ByteArray(12).also { bytes.get(it) }
    val encrypted = ByteArray(48).also { bytes.get(it) }
    val checksum = ByteArray(32).also { bytes.get(it) }
    check(bytes.position() == FILE_LENGTH)
    if (!MessageDigest.isEqual(digest(data.copyOfRange(0, PAYLOAD_LENGTH)), checksum))
      return rejected(SyntheticPortableEnvelopeCheck.DENY_CHECKSUM)
    if (version <= 0L || generation <= 0L || !uuidFormat.matches(id))
      return rejected(SyntheticPortableEnvelopeCheck.DENY_METADATA)
    return SyntheticPortableEnvelopeImportLab(
      SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED,
      SyntheticRecoveryKitEnvelopeLab(account, id, version, generation, salt, nonce, encrypted)
    )
  }
}
