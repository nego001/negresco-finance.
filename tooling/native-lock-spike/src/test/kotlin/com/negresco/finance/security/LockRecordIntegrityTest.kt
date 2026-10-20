package com.negresco.finance.security

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

private fun syntheticMac(seed: Byte): LockRecordMac {
  val key = SecretKeySpec(ByteArray(32) { seed }, "HmacSHA256")
  return LockRecordMac { bytes ->
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(key)
    mac.doFinal(bytes)
  }
}

/** Offline synthetic vectors only. No AndroidKeyStore or physical hardware. */
internal fun runLockIntegrityScenarios() {
  val signer = syntheticMac(0x42)
  val record = LockRecord(1, true, 7L)
  val tag = LockRecordIntegrity.seal(record, signer)

  // 1. Unchanged state + same synthetic MAC key passes verification.
  check(LockRecordIntegrity.verify(record, tag, signer) == LockIntegrityResult.VALID)

  // 2. Changing the enabled preference without resealing is rejected.
  check(LockRecordIntegrity.verify(record.copy(enabled = false), tag, signer) ==
    LockIntegrityResult.INVALID)

  // 3. A different revision cannot reuse this tag.
  check(LockRecordIntegrity.verify(record.copy(revision = 8L), tag, signer) ==
    LockIntegrityResult.INVALID)

  // 4. Pending opt-out marker is cryptographically authenticated too.
  check(LockRecordIntegrity.verify(record.copy(disablePending = true), tag, signer) ==
    LockIntegrityResult.INVALID)

  // 5. Missing tag cannot authenticate the state.
  check(LockRecordIntegrity.verify(record, null, signer) == LockIntegrityResult.INVALID)

  // 6. Truncated MAC is rejected even when its prefix is correct.
  check(LockRecordIntegrity.verify(record, tag.copyOf(8), signer) == LockIntegrityResult.INVALID)

  // 7. Wrong key cannot forge a valid tag.
  check(LockRecordIntegrity.verify(record, tag, syntheticMac(0x43)) == LockIntegrityResult.INVALID)

  // 8. Bit-flip corruption in the tag is rejected.
  val damaged = tag.copyOf().also { it[15] = (it[15].toInt() xor 1).toByte() }
  check(LockRecordIntegrity.verify(record, damaged, signer) == LockIntegrityResult.INVALID)

  // 9. Unsupported future protocol version cannot authenticate.
  check(LockRecordIntegrity.verify(record.copy(version = 2), tag, signer) ==
    LockIntegrityResult.INVALID)

  // 10. Contradictory pending+disabled native record must not be sealed.
  check(runCatching {
    LockRecordIntegrity.seal(record.copy(enabled = false, disablePending = true), signer)
  }.isFailure)

  // 11. A missing Keystore key must deny verification, never provision one.
  check(LockRecordIntegrity.verify(record, tag, LockRecordMac { error("key missing") }) ==
    LockIntegrityResult.KEY_UNAVAILABLE)

  // 12. A MAC provider emitting wrong-length tags cannot be trusted.
  check(LockRecordIntegrity.verify(record, tag, LockRecordMac { ByteArray(4) }) ==
    LockIntegrityResult.KEY_UNAVAILABLE)

  // 13. Exact canonicalization is stable and independent of object identity.
  check(LockRecordIntegrity.canonical(record).contentEquals(
    LockRecordIntegrity.canonical(record.copy())))

  // 14. A properly authenticated pending marker is valid, but still LOCKED.
  val pending = record.copy(disablePending = true)
  check(LockRecordIntegrity.verify(pending, LockRecordIntegrity.seal(pending, signer), signer) ==
    LockIntegrityResult.VALID)
  check(pending.enabled && pending.disablePending)

  // 15. CRITICAL LIMIT: a previously sealed record remains valid if replayed.
  // HMAC is an integrity check, NOT a persistent monotonic anti-rollback anchor.
  val old = record.copy(revision = 1L)
  val oldTag = LockRecordIntegrity.seal(old, signer)
  check(LockRecordIntegrity.verify(old, oldTag, signer) == LockIntegrityResult.VALID)

  println("PASS: 15 HMAC integrity scenarios (synthetic JVM, replay limit documented)")
}
