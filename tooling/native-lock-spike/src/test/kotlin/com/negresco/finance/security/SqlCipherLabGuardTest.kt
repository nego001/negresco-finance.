package com.negresco.finance.security

/** Offline policy scenarios, NOT actual SQLCipher or Android database tests. */
internal fun runSqlCipherLabGuardScenarios() {
  val plaintextHeader = "SQLite format 3\u0000".toByteArray(Charsets.US_ASCII)
  check(plaintextHeader.size == 16)

  // 1. Missing DB is refused; no implicit database creation on openExisting.
  check(SqlCipherLabGuard.inspectExistingHeader(null) == SqlCipherLabFileVerdict.REFUSE_MISSING)
  // 2. Empty data fails closed instead of being treated as a new database.
  check(SqlCipherLabGuard.inspectExistingHeader(byteArrayOf()) ==
    SqlCipherLabFileVerdict.REFUSE_TRUNCATED)
  // 3. Truncated SQLite headers fail before a native open.
  check(SqlCipherLabGuard.inspectExistingHeader(plaintextHeader.copyOf(15)) ==
    SqlCipherLabFileVerdict.REFUSE_TRUNCATED)
  // 4. Full plaintext SQLite signature is refused.
  check(SqlCipherLabGuard.inspectExistingHeader(plaintextHeader) ==
    SqlCipherLabFileVerdict.REFUSE_PLAINTEXT_SQLITE)
  // 5. Plaintext header followed by content remains plaintext and refused.
  check(SqlCipherLabGuard.inspectExistingHeader(plaintextHeader + ByteArray(128)) ==
    SqlCipherLabFileVerdict.REFUSE_PLAINTEXT_SQLITE)
  // 6. Cipher-looking header is only eligible for mandatory keyed SQLCipher
  // verification, not automatically accepted as authentic/encrypted.
  check(SqlCipherLabGuard.inspectExistingHeader(ByteArray(16) { (it + 1).toByte() }) ==
    SqlCipherLabFileVerdict.REQUIRE_NATIVE_KEYED_OPEN)
  // 7. Any unrecognized 16-byte header also needs the native keyed read.
  val modified = plaintextHeader.copyOf().also { it[0] = 0x21 }
  check(SqlCipherLabGuard.inspectExistingHeader(modified) ==
    SqlCipherLabFileVerdict.REQUIRE_NATIVE_KEYED_OPEN)
  // 8. Missing/empty passphrase is forbidden.
  check(runCatching { SqlCipherLabGuard.validateSyntheticPassphrase(byteArrayOf()) }.isFailure)
  // 9. Short passphrase is refused.
  check(runCatching { SqlCipherLabGuard.validateSyntheticPassphrase(ByteArray(16) { 1 }) }.isFailure)
  // 10. Excessively long passphrase cannot be silently truncated.
  check(runCatching { SqlCipherLabGuard.validateSyntheticPassphrase(ByteArray(64) { 1 }) }.isFailure)
  // 11. All-zero synthetic passphrase is refused.
  check(runCatching { SqlCipherLabGuard.validateSyntheticPassphrase(ByteArray(32)) }.isFailure)
  // 12. Exactly 32 nonzero synthetic bytes meet input policy (NOT a
  // production entropy assessment or a valid SQLCipher native key test).
  SqlCipherLabGuard.validateSyntheticPassphrase(ByteArray(32) { (it + 1).toByte() })

  println("PASS: 12 SQLCipher pre-open fail-closed policy scenarios (JVM, no native database)")
}
