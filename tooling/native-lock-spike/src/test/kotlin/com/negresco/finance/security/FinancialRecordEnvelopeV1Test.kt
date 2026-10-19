package com.negresco.finance.security

import javax.crypto.spec.SecretKeySpec

private fun fakeAes256(marker: Byte): SecretKeySpec =
  SecretKeySpec(ByteArray(32) { (marker.toInt() + it).toByte() }, "AES")

/**
 * Disposable records and fake keys ONLY. No Android hardware, SQLCipher,
 * banking data, device recovery or security-certification claims.
 */
internal fun runFinancialEnvelopeScenarios() {
  val key = fakeAes256(0x21)
  val other = fakeAes256(0x45)
  val context = FinancialRecordContext("transaction", "synthetic-001", 5L)
  val plaintext = "fictitious-finance-record".toByteArray(Charsets.UTF_8)
  val encrypted = FinancialRecordEnvelopeV1.encrypt(plaintext, context, "lab-financial-1", key)
  val normal = FinancialKeyResolver { if (it == "lab-financial-1") key else null }
  fun fails(envelope: ByteArray, metadata: FinancialRecordContext = context,
    resolver: FinancialKeyResolver = normal): Boolean =
    runCatching { FinancialRecordEnvelopeV1.decrypt(envelope, metadata, resolver) }.isFailure

  // 1. Real AES-GCM round-trip for a fictional record.
  check(FinancialRecordEnvelopeV1.decrypt(encrypted, context, normal).contentEquals(plaintext))

  // 2. Ciphertext never contains the known plaintext as an unchanged substring.
  check(!encrypted.toString(Charsets.ISO_8859_1).contains("fictitious-finance-record"))

  // 3. A fresh nonce must be generated on each call by the JCA provider.
  val second = FinancialRecordEnvelopeV1.encrypt(plaintext, context, "lab-financial-1", key)
  check(!encrypted.contentEquals(second))
  check(FinancialRecordEnvelopeV1.decrypt(second, context, normal).contentEquals(plaintext))

  // 4. Wrong existing AES key cannot decrypt.
  check(fails(encrypted, resolver = FinancialKeyResolver { other }))

  // 5. Missing/unprovisioned key refuses access; decrypt never generates one.
  check(runCatching {
    FinancialRecordEnvelopeV1.decrypt(encrypted, context, FinancialKeyResolver { null })
  }.exceptionOrNull() is FinancialEnvelopeKeyUnavailable)

  // 6. Record ID tampering is authenticated through external context (AAD).
  check(fails(encrypted, metadata = context.copy(logicalId = "synthetic-002")))

  // 7. Record type substitution is rejected.
  check(fails(encrypted, metadata = context.copy(type = "bank-account")))

  // 8. Revision mismatch is rejected; callers must know expected revision.
  check(fails(encrypted, metadata = context.copy(revision = 6L)))

  // 9. Invalid negative external revision is refused.
  check(fails(encrypted, metadata = context.copy(revision = -1L)))

  // 10. Ciphertext corruption fails authentication.
  val mutated = encrypted.copyOf().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
  check(fails(mutated))

  // 11. GCM nonce corruption fails authentication.
  val nonceChanged = encrypted.copyOf().also {
    val nonceOffset = 4 + 4 + 2 + "lab-financial-1".length + 1
    it[nonceOffset] = (it[nonceOffset].toInt() xor 1).toByte()
  }
  check(fails(nonceChanged))

  // 12. Invalid magic/version is rejected instead of plaintext fallback.
  val changedMagic = encrypted.copyOf().also { it[0] = 0 }
  check(fails(changedMagic))
  val changedVersion = encrypted.copyOf().also { it[7] = 2 }
  check(fails(changedVersion))

  // 13. Truncated envelope cannot yield partially decrypted content.
  check(fails(encrypted.copyOf(encrypted.size - 2)))

  // 14. Appended bytes are rejected, no trailing garbage or concat records.
  check(fails(encrypted + byteArrayOf(7)))

  // 15. Altering the serialized key identifier never bypasses GCM AAD.
  val changedKeyId = encrypted.copyOf().also {
    val keyIdOffset = 4 + 4 + 2
    it[keyIdOffset] = 'z'.code.toByte()
  }
  check(fails(changedKeyId, resolver = FinancialKeyResolver { key }))

  // 16. Unauthenticated files/ordinary SQLite plaintext are not envelopes.
  check(fails("SQLite format 3\u0000".toByteArray()))

  // 17. Weak (AES-128) raw key is rejected for encryption.
  check(runCatching {
    FinancialRecordEnvelopeV1.encrypt(
      plaintext, context, "lab-financial-1", SecretKeySpec(ByteArray(16), "AES")
    )
  }.isFailure)

  // 18. Overlarge records are refused before allocation or encryption.
  check(runCatching {
    FinancialRecordEnvelopeV1.encrypt(ByteArray(1024 * 1024 + 1), context, "lab-financial-1", key)
  }.isFailure)

  // 19. Empty or unsafe context identifiers cannot be authenticated.
  check(runCatching {
    FinancialRecordEnvelopeV1.encrypt(plaintext, context.copy(logicalId = "../x"), "lab-financial-1", key)
  }.isFailure)

  // 20. Key identifiers must be well-formed and are bound to ciphertext.
  check(runCatching {
    FinancialRecordEnvelopeV1.encrypt(plaintext, context, "unsafe key id", key)
  }.isFailure)

  // 21. Envelopes are bound to different records, not just a reused type.
  val contextB = context.copy(logicalId = "synthetic-009")
  val encryptedB = FinancialRecordEnvelopeV1.encrypt(plaintext, contextB, "lab-financial-1", key)
  check(fails(encryptedB))
  check(FinancialRecordEnvelopeV1.decrypt(encryptedB, contextB, normal).contentEquals(plaintext))

  // 22. Explicit replay limit: original envelope + original metadata remains valid.
  // An external trusted counter/manifest is needed for cross-process anti-rollback.
  val previouslySaved = encrypted.copyOf()
  check(FinancialRecordEnvelopeV1.decrypt(previouslySaved, context, normal).contentEquals(plaintext))

  // 23. Empty synthetic content is authenticated without plaintext fallback.
  val empty = FinancialRecordEnvelopeV1.encrypt(byteArrayOf(), context, "lab-financial-1", key)
  check(FinancialRecordEnvelopeV1.decrypt(empty, context, normal).isEmpty())

  println("PASS: 23 synthetic AES-256-GCM financial envelope scenarios (no SQLCipher/Android QA)")
}
