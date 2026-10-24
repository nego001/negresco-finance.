package com.negresco.finance.security

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.security.MessageDigest
import java.nio.charset.StandardCharsets

/**
 * Experimental integrity seal for the native-lock record.
 *
 * HMAC detects MODIFIED data when the key is available. A previously valid,
 * sealed record can still be replayed after process death: THIS IS NOT an
 * anti-rollback anchor and grants NO biometric or financial-data access.
 */
internal fun interface LockRecordMac {
  fun compute(bytes: ByteArray): ByteArray
}

internal enum class LockIntegrityResult {
  VALID,
  INVALID,
  KEY_UNAVAILABLE
}

internal object LockRecordIntegrity {
  private val domain = "negresco.finance.native-lock.integrity.v1".toByteArray(StandardCharsets.US_ASCII)
  private const val HMAC_SHA256_BYTES = 32

  /**
   * Deterministic binary encoding with a fixed domain separator and exact
   * field widths. Avoid JSON, string booleans, locale or object.toString().
   */
  internal fun canonical(record: LockRecord): ByteArray {
    require(record.version == LOCK_RECORD_VERSION && record.revision >= 0L &&
      !(record.disablePending && !record.enabled)) { "Invalid lock record cannot be sealed" }

    val buffer = ByteArrayOutputStream()
    DataOutputStream(buffer).use { output ->
      output.writeInt(domain.size)
      output.write(domain)
      output.writeInt(record.version)
      output.writeByte(if (record.enabled) 1 else 0)
      output.writeLong(record.revision)
      output.writeByte(if (record.disablePending) 1 else 0)
    }
    return buffer.toByteArray()
  }

  /**
   * Only call seal after an independently authorized native operation.
   * This helper does not generate/provision key material.
   */
  fun seal(record: LockRecord, mac: LockRecordMac): ByteArray {
    val tag = mac.compute(canonical(record))
    check(tag.size == HMAC_SHA256_BYTES) { "Expected HMAC-SHA256 tag" }
    return tag.copyOf()
  }

  /**
   * Always fail closed. In particular missing tag, incorrect tag length,
   * invalid record or unavailable key never become "off" or "unlocked".
   */
  fun verify(record: LockRecord, tag: ByteArray?, mac: LockRecordMac): LockIntegrityResult {
    if (tag == null || tag.size != HMAC_SHA256_BYTES) return LockIntegrityResult.INVALID
    val encoded = try { canonical(record) }
      catch (_: IllegalArgumentException) { return LockIntegrityResult.INVALID }
    val expected = try { mac.compute(encoded) }
      catch (_: Exception) { return LockIntegrityResult.KEY_UNAVAILABLE }
    if (expected.size != HMAC_SHA256_BYTES) return LockIntegrityResult.KEY_UNAVAILABLE
    return if (MessageDigest.isEqual(expected, tag)) LockIntegrityResult.VALID
    else LockIntegrityResult.INVALID
  }
}
