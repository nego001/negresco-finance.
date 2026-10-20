package com.negresco.finance.security

/**
 * Pure policy for the isolated SQLCipher Android test database.
 *
 * A random-looking header is NOT proof of encryption: only an actual
 * SQLCipher native open plus a keyed read may accept an existing file.
 * There is deliberately no API for Android platform SQLite fallback.
 */
internal enum class SqlCipherLabFileVerdict {
  REQUIRE_NATIVE_KEYED_OPEN,
  REFUSE_MISSING,
  REFUSE_TRUNCATED,
  REFUSE_PLAINTEXT_SQLITE
}

internal object SqlCipherLabGuard {
  private val SQLITE_HEADER = byteArrayOf(
    'S'.code.toByte(), 'Q'.code.toByte(), 'L'.code.toByte(), 'i'.code.toByte(),
    't'.code.toByte(), 'e'.code.toByte(), ' '.code.toByte(), 'f'.code.toByte(),
    'o'.code.toByte(), 'r'.code.toByte(), 'm'.code.toByte(), 'a'.code.toByte(),
    't'.code.toByte(), ' '.code.toByte(), '3'.code.toByte(), 0
  )
  const val SYNTHETIC_PASSPHRASE_BYTES = 32

  fun validateSyntheticPassphrase(bytes: ByteArray) {
    require(bytes.size == SYNTHETIC_PASSPHRASE_BYTES) {
      "Only a synthetic 32-byte random passphrase is accepted"
    }
    require(bytes.any { it.toInt() != 0 }) {
      "All-zero synthetic passphrase is refused"
    }
  }

  fun inspectExistingHeader(header: ByteArray?): SqlCipherLabFileVerdict {
    if (header == null) return SqlCipherLabFileVerdict.REFUSE_MISSING
    if (header.size < SQLITE_HEADER.size) return SqlCipherLabFileVerdict.REFUSE_TRUNCATED
    if (SQLITE_HEADER.indices.all { header[it] == SQLITE_HEADER[it] })
      return SqlCipherLabFileVerdict.REFUSE_PLAINTEXT_SQLITE
    return SqlCipherLabFileVerdict.REQUIRE_NATIVE_KEYED_OPEN
  }
}
