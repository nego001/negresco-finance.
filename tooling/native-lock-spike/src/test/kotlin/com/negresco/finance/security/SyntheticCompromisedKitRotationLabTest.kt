package com.negresco.finance.security

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** SEC-05J: fabricated records and keys; no user balances or banking data. */
internal fun runSyntheticCompromisedKitRotationScenarios() {
  val rng = SecureRandom()
  fun random32() = ByteArray(32).also { rng.nextBytes(it) }
  val account = "a".repeat(32)
  val other = "b".repeat(32)
  val plaintexts = linkedMapOf(
    "note_1" to "synthetic fixture one".toByteArray(),
    "note_2" to "synthetic fixture two".toByteArray(),
    "note_3" to "synthetic fixture three".toByteArray()
  )
  val oldDataKey = random32()
  val oldKit = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(
    account, oldDataKey, 1L, 2L
  )
  val oldSecret = oldKit.recoverySecretCopyForFixtureOnly()
  val oldFile = SyntheticPortableRecoveryEnvelopeLab.exportEnvelopeBytesFixtureOnly(
    oldKit.envelope
  )
  val lab = SyntheticCompromisedKitRotationLab.seedFixtureOnly(
    account, oldDataKey, oldKit, plaintexts
  )
  val initial = lab.snapshotFixtureOnly()
  fun verifyEqual(a: SyntheticRekeySnapshotLab, b: SyntheticRekeySnapshotLab) {
    check(a.accountId == b.accountId)
    check(a.kitId == b.kitId && a.version == b.version && a.generation == b.generation)
    check(a.retiredKitIds == b.retiredKitIds && a.records.keys == b.records.keys)
    for (id in a.records.keys) {
      val x = a.records.getValue(id)
      val y = b.records.getValue(id)
      check(x.version == y.version && x.generation == y.generation)
      check(x.nonceCopy().contentEquals(y.nonceCopy()))
      check(x.ciphertextCopy().contentEquals(y.ciphertextCopy()))
    }
  }
  fun attempt(
    expectedAccount: String = account,
    expectedKitId: String = initial.kitId,
    file: ByteArray? = oldFile,
    secret: ByteArray? = oldSecret,
    abortAt: Int? = null
  ) = lab.rotateCompromisedKitFixtureOnly(
    expectedAccount, expectedKitId, file, secret, abortAt
  )

  // 1: fixture starts with three ciphertext records, not plaintext records.
  check(initial.records.size == 3)
  check(initial.retiredKitIds.isEmpty())
  check(initial.version == 1L && initial.generation == 2L)

  // 2: old DEK authenticates each original record before re-encryption.
  for ((id, source) in plaintexts) {
    check(SyntheticRecordCipherLab.decryptFixtureOnly(
      account, initial.records.getValue(id), oldDataKey
    )!!.contentEquals(source))
  }

  // 3: wrong account cannot request even a synthetic rekey.
  check(attempt(expectedAccount = other).check == SyntheticRekeyCheck.DENY_UNKNOWN_ACCOUNT)

  // 4: mismatched expected kit is a stale conflict.
  check(attempt(expectedKitId = "123e4567-e89b-42d3-a456-426614174000").check ==
    SyntheticRekeyCheck.DENY_EXPECTED_KIT_MISMATCH)

  // 5: absent file is not a recovery authority.
  check(attempt(file = null).check == SyntheticRekeyCheck.DENY_INVALID_BACKUP_OR_SECRET)

  // 6: absent secret is not an empty-password fallback.
  check(attempt(secret = null).check == SyntheticRekeyCheck.DENY_INVALID_BACKUP_OR_SECRET)

  // 7: wrong random recovery secret cannot recover old DEK.
  check(attempt(secret = random32()).check == SyntheticRekeyCheck.DENY_INVALID_BACKUP_OR_SECRET)

  // 8: six digit PIN is never an alternative to high-entropy recovery secret.
  check(attempt(secret = "123456".toByteArray()).check ==
    SyntheticRekeyCheck.DENY_INVALID_BACKUP_OR_SECRET)

  // 9: truncation is denied before touching data state.
  check(attempt(file = oldFile.copyOf(183)).check ==
    SyntheticRekeyCheck.DENY_INVALID_BACKUP_OR_SECRET)

  // 10: public checksum-recomputed tampering is not trusted.
  val forgedFile = oldFile.copyOf().also {
    it[104] = (it[104].toInt() xor 1).toByte()
    MessageDigest.getInstance("SHA-256").digest(it.copyOfRange(0, 152))
      .copyInto(it, 152)
  }
  check(attempt(file = forgedFile).check == SyntheticRekeyCheck.DENY_INVALID_BACKUP_OR_SECRET)

  // 11: no negative mutation happened due to malformed requests.
  verifyEqual(initial, lab.snapshotFixtureOnly())

  // 12: an abort after staging the first record changes NOTHING.
  check(attempt(abortAt = 1).check == SyntheticRekeyCheck.DENY_INJECTED_ABORT_NO_MUTATION)
  verifyEqual(initial, lab.snapshotFixtureOnly())

  // 13: abort halfway through three record writes changes NOTHING.
  check(attempt(abortAt = 2).check == SyntheticRekeyCheck.DENY_INJECTED_ABORT_NO_MUTATION)
  verifyEqual(initial, lab.snapshotFixtureOnly())

  // 14: even an abort after all records staged changes NOTHING.
  check(attempt(abortAt = 3).check == SyntheticRekeyCheck.DENY_INJECTED_ABORT_NO_MUTATION)
  verifyEqual(initial, lab.snapshotFixtureOnly())

  // 15: normal rotation emits a new kit only after successful staging.
  val rotated = attempt()
  check(rotated.check == SyntheticRekeyCheck.REKEYED_FIXTURE_ONLY_NOT_AUTHORIZATION)
  val newKit = rotated.freshKitFixtureOnly!!
  val newSnapshot = lab.snapshotFixtureOnly()
  check(newSnapshot.kitId == newKit.envelope.kitId)
  check(newSnapshot.version == 2L && newSnapshot.generation == 3L)
  check(initial.kitId in newSnapshot.retiredKitIds)

  // 16: generated replacement secret and kit ID are actually distinct.
  val nextSecret = newKit.recoverySecretCopyForFixtureOnly()
  check(!nextSecret.contentEquals(oldSecret))
  check(newKit.envelope.kitId != oldKit.envelope.kitId)

  // 17: the new portable backup parses with the same account, version and generation.
  val newFile = lab.encryptedBackupFixtureOnly()
  val parsed = SyntheticPortableRecoveryEnvelopeLab.importEnvelopeBytesFixtureOnly(
    newFile, account
  )
  check(parsed.check == SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED)
  check(parsed.envelope!!.kitId == newSnapshot.kitId)
  check(parsed.envelope.keyVersion == 2L && parsed.envelope.ownerGeneration == 3L)

  // 18: new DEK is recoverable independently using separate new kit secret.
  val nextKey = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
    parsed.envelope, nextSecret
  )!!.copyForFixtureOnly()
  check(nextKey.size == 32)
  check(!nextKey.contentEquals(oldDataKey))

  // 19: all three records retain exact plaintext under the new DEK.
  for ((id, plain) in plaintexts) {
    check(SyntheticRecordCipherLab.decryptFixtureOnly(
      account, newSnapshot.records.getValue(id), nextKey
    )!!.contentEquals(plain))
  }

  // 20: every migrated record has fresh ciphertext, nonce and bound version.
  for (id in plaintexts.keys) {
    val old = initial.records.getValue(id)
    val current = newSnapshot.records.getValue(id)
    check(current.version == 2L && current.generation == 3L)
    check(!old.nonceCopy().contentEquals(current.nonceCopy()))
    check(!old.ciphertextCopy().contentEquals(current.ciphertextCopy()))
  }

  // 21: old data key cannot decrypt new ciphertext.
  for (id in plaintexts.keys) {
    check(SyntheticRecordCipherLab.decryptFixtureOnly(
      account, newSnapshot.records.getValue(id), oldDataKey
    ) == null)
  }

  // 22: new data key cannot decrypt original ciphertext.
  for (id in plaintexts.keys) {
    check(SyntheticRecordCipherLab.decryptFixtureOnly(
      account, initial.records.getValue(id), nextKey
    ) == null)
  }

  // 23: using a current DEK under the wrong account is forbidden by AES-GCM AAD.
  check(SyntheticRecordCipherLab.decryptFixtureOnly(
    other, newSnapshot.records.getValue("note_1"), nextKey
  ) == null)

  // 24: swapping ciphertext between record IDs cannot pass AAD.
  val swap = newSnapshot.records.getValue("note_2")
  val stolen = SyntheticEncryptedRecordLab(
    "note_1", swap.version, swap.generation, swap.nonceCopy(), swap.ciphertextCopy()
  )
  check(SyntheticRecordCipherLab.decryptFixtureOnly(account, stolen, nextKey) == null)

  // 25: rebranding the version/generation makes ciphertext fail authentication.
  val first = newSnapshot.records.getValue("note_1")
  val staleVersion = SyntheticEncryptedRecordLab(
    first.id, 1L, first.generation, first.nonceCopy(), first.ciphertextCopy()
  )
  val staleEpoch = SyntheticEncryptedRecordLab(
    first.id, first.version, 2L, first.nonceCopy(), first.ciphertextCopy()
  )
  check(SyntheticRecordCipherLab.decryptFixtureOnly(account, staleVersion, nextKey) == null)
  check(SyntheticRecordCipherLab.decryptFixtureOnly(account, staleEpoch, nextKey) == null)

  // 26: replaying old kit after rotation never produces another migration.
  check(attempt().check == SyntheticRekeyCheck.DENY_EXPECTED_KIT_MISMATCH)

  // 27: metadata revocation cannot magically destroy old OFFLINE copies.
  val restoredOldKey = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
    oldKit.envelope, oldSecret
  )!!.copyForFixtureOnly()
  check(restoredOldKey.contentEquals(oldDataKey))
  check(SyntheticRecordCipherLab.decryptFixtureOnly(
    account, initial.records.getValue("note_1"), restoredOldKey
  )!!.contentEquals(plaintexts.getValue("note_1")))
  restoredOldKey.fill(0)

  // 28: injected corruption of a synthetic ciphertext fails closed,
  // without replacing even one record or changing the active kit.
  val faultLab = SyntheticCompromisedKitRotationLab.seedFixtureOnly(
    account, oldDataKey, oldKit, plaintexts
  )
  check(faultLab.corruptRecordFixtureOnly("note_2"))
  val beforeFault = faultLab.snapshotFixtureOnly()
  val fail = faultLab.rotateCompromisedKitFixtureOnly(
    account, oldKit.envelope.kitId, oldFile, oldSecret
  )
  check(fail.check == SyntheticRekeyCheck.DENY_CORRUPT_OLD_CIPHERTEXT)
  check(fail.freshKitFixtureOnly == null)
  verifyEqual(beforeFault, faultLab.snapshotFixtureOnly())

  // 29: initial fixture cannot treat an unrelated DEK as identical.
  check(runCatching {
    SyntheticCompromisedKitRotationLab.seedFixtureOnly(account, random32(), oldKit, plaintexts)
  }.isFailure)

  // 30: even a valid kit cannot bootstrap a different account.
  check(runCatching {
    SyntheticCompromisedKitRotationLab.seedFixtureOnly(other, oldDataKey, oldKit, plaintexts)
  }.isFailure)

  // 31: a brand-new live kit can rotate again, without knowing the original kit.
  val again = lab.rotateCompromisedKitFixtureOnly(
    account, newKit.envelope.kitId, newFile, nextSecret
  )
  check(again.check == SyntheticRekeyCheck.REKEYED_FIXTURE_ONLY_NOT_AUTHORIZATION)
  check(lab.snapshotFixtureOnly().version == 3L)
  check(lab.snapshotFixtureOnly().generation == 4L)

  // 32: running eight rotations against the same kit succeeds once only.
  val thirdKit = again.freshKitFixtureOnly!!
  val thirdFile = lab.encryptedBackupFixtureOnly()
  val thirdSecret = thirdKit.recoverySecretCopyForFixtureOnly()
  val start = CountDownLatch(1)
  val pool = Executors.newFixedThreadPool(8)
  try {
    val tasks = (1..8).map {
      pool.submit<SyntheticRekeyCheck> {
        start.await()
        lab.rotateCompromisedKitFixtureOnly(
          account, thirdKit.envelope.kitId, thirdFile, thirdSecret
        ).check
      }
    }
    start.countDown()
    val outcome = tasks.map { it.get(30, TimeUnit.SECONDS) }
    check(outcome.count { it == SyntheticRekeyCheck.REKEYED_FIXTURE_ONLY_NOT_AUTHORIZATION } == 1)
    check(outcome.count { it == SyntheticRekeyCheck.DENY_EXPECTED_KIT_MISMATCH } == 7)
  } finally {
    pool.shutdownNow()
  }

  // 33: all rotated kits remain retired metadata, not credential-grant state.
  check(lab.snapshotFixtureOnly().retiredKitIds.contains(oldKit.envelope.kitId))
  check(lab.snapshotFixtureOnly().retiredKitIds.contains(newKit.envelope.kitId))
  check(SyntheticRekeyCheck.entries.none {
    it.name == "ENROLLED" || it.name == "LOGIN_SUCCESS" || it.name == "ALLOW_TRANSFER"
  })

  // 34: even after second and third rotations, historical offline decrypt stays true.
  check(SyntheticRecordCipherLab.decryptFixtureOnly(
    account, initial.records.getValue("note_3"), oldDataKey
  )!!.contentEquals(plaintexts.getValue("note_3")))

  oldDataKey.fill(0)
  oldSecret.fill(0)
  nextKey.fill(0)
  nextSecret.fill(0)
  thirdSecret.fill(0)
  plaintexts.values.forEach { it.fill(0) }
  println("PASS: SEC-05J 34 compromised-kit staged rekey, rollback, tamper and concurrency scenarios (JVM lab)")
}
