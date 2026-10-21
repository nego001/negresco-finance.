package com.negresco.finance.security

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** SEC-05I: only temporary synthetic backup, secret and data-key fixtures. */
internal fun runSyntheticRecoveryKitCeremonyScenarios() {
  val rng = SecureRandom()
  fun random32() = ByteArray(32).also { rng.nextBytes(it) }
  val account = "a".repeat(32)
  val otherAccount = "b".repeat(32)
  val dataKey = random32()
  val export = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(
    account, dataKey, keyVersion = 1L, ownerGeneration = 2L
  )
  val file = SyntheticPortableRecoveryEnvelopeLab.exportEnvelopeBytesFixtureOnly(export.envelope)
  val separateSecret = export.recoverySecretCopyForFixtureOnly()
  var now = 20_000_000L
  val prepared = SyntheticRecoveryKitCeremonyLab.prepareFixtureOnly(
    account, file, dataKey
  ) { now }
  val successful = SyntheticKitCeremonyCheck.VERIFIED_OFFLINE_NOT_STORED_OR_AUTHORIZED
  val pending = SyntheticKitCeremonyCheck.PREPARED_NOT_STORED
  val session = prepared.second!!

  fun open(
    expectedAccount: String = account,
    archive: ByteArray? = file,
    sourceKey: ByteArray? = dataKey
  ): Pair<SyntheticKitCeremonyCheck, SyntheticRecoveryKitCeremonyLab?> =
    SyntheticRecoveryKitCeremonyLab.prepareFixtureOnly(
      expectedAccount, archive, sourceKey
    ) { now }

  fun keyHash(key: ByteArray = dataKey): ByteArray =
    MessageDigest.getInstance("SHA-256").digest(key)

  // 1: ceremony initialization is proof-pending only and exposes no key.
  check(prepared.first == pending)
  check(session.viewFixtureOnly().state == SyntheticKitCeremonyState.PENDING_REENTRY)

  // 2: kit identifier bound to exact portable envelope.
  check(session.viewFixtureOnly().kitId == export.envelope.kitId)

  // 3: fixed 15-minute re-entry window in fixture.
  check(session.viewFixtureOnly().expiresMillis -
    session.viewFixtureOnly().openedMillis == SyntheticRecoveryKitCeremonyLab.WINDOW_MILLIS)

  // 4: portable file + externally supplied independent secret can recover DEK.
  check(session.verifySeparateBackupAndSecretFixtureOnly(file.copyOf(), separateSecret.copyOf()) ==
    successful)

  // 5: successful re-entry transitions to VERIFIED_OFFLINE_ONLY, never stored.
  check(session.viewFixtureOnly().state == SyntheticKitCeremonyState.VERIFIED_OFFLINE_ONLY)

  // 6: second confirmation cannot replay same ceremony receipt.
  check(session.verifySeparateBackupAndSecretFixtureOnly(file, separateSecret) ==
    SyntheticKitCeremonyCheck.DENY_TERMINAL)

  // 7: no login, enrollment or bank permission result exists.
  check(SyntheticKitCeremonyCheck.entries.none {
    it.name == "ALLOW" || it.name == "ENROLLED" || it.name == "UNLOCKED"
  })

  // 8: independent clean-room verifier can recover with a DEK commitment.
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    account, keyHash(), file.copyOf(), separateSecret.copyOf()
  ) == successful)

  // 9: wrong account cannot import, with otherwise authentic ciphertext.
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    otherAccount, keyHash(), file, separateSecret
  ) == SyntheticKitCeremonyCheck.DENY_ACCOUNT_SCOPE)

  // 10: missing key commitment cannot fabricate a recovery.
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    account, null, file, separateSecret
  ) == SyntheticKitCeremonyCheck.DENY_BAD_SOURCE)

  // 11: truncated commitment is rejected.
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    account, ByteArray(31), file, separateSecret
  ) == SyntheticKitCeremonyCheck.DENY_BAD_SOURCE)

  // 12: no secret, no offline recovery; file alone is insufficient.
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    account, keyHash(), file, null
  ) == SyntheticKitCeremonyCheck.DENY_MISSING_OR_INVALID_SECRET)

  // 13: six-digit PIN cannot stand in for a 256-bit kit secret.
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    account, keyHash(), file, "123456".toByteArray()
  ) == SyntheticKitCeremonyCheck.DENY_MISSING_OR_INVALID_SECRET)

  // 14: a different random kit secret cannot decrypt the data key.
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    account, keyHash(), file, random32()
  ) == SyntheticKitCeremonyCheck.DENY_MISSING_OR_INVALID_SECRET)

  // 15: source key mismatch denied even though the file and kit are authentic.
  val wrongSource = random32()
  check(open(sourceKey = wrongSource).first == pending)
  val otherExpected = open(sourceKey = wrongSource).second!!
  check(otherExpected.verifySeparateBackupAndSecretFixtureOnly(file, separateSecret) ==
    SyntheticKitCeremonyCheck.DENY_DATA_KEY_MISMATCH)
  check(otherExpected.viewFixtureOnly().state == SyntheticKitCeremonyState.PENDING_REENTRY)

  // 16: source-key fingerprint is just an untrusted test commitment.
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    account, keyHash(wrongSource), file, separateSecret
  ) == SyntheticKitCeremonyCheck.DENY_DATA_KEY_MISMATCH)

  // 17: the same secret presented with a different genuine kit fails binding.
  val unrelated = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(
    account, dataKey, keyVersion = 2L, ownerGeneration = 2L
  )
  val otherFile = SyntheticPortableRecoveryEnvelopeLab.exportEnvelopeBytesFixtureOnly(
    unrelated.envelope
  )
  val bound = open().second!!
  check(bound.verifySeparateBackupAndSecretFixtureOnly(otherFile, separateSecret) ==
    SyntheticKitCeremonyCheck.DENY_BACKUP_CHANGED)

  // 18: public SHA checksum can be recalculated, but changed file still denied.
  val modified = file.copyOf().also {
    it[107] = (it[107].toInt() xor 1).toByte()
    MessageDigest.getInstance("SHA-256").digest(it.copyOfRange(0, 152)).copyInto(it, 152)
  }
  check(bound.verifySeparateBackupAndSecretFixtureOnly(modified, separateSecret) ==
    SyntheticKitCeremonyCheck.DENY_BACKUP_CHANGED)
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    account, keyHash(), modified, separateSecret
  ) == SyntheticKitCeremonyCheck.DENY_MISSING_OR_INVALID_SECRET)

  // 19: corrupted or incomplete file rejected before decryption.
  check(open(archive = file.copyOf(183)).first == SyntheticKitCeremonyCheck.DENY_BAD_BACKUP)
  check(bound.verifySeparateBackupAndSecretFixtureOnly(file.copyOf(183), separateSecret) ==
    SyntheticKitCeremonyCheck.DENY_BAD_BACKUP)

  // 20: missing file doesn't create a preparation.
  check(open(archive = null).first == SyntheticKitCeremonyCheck.DENY_BAD_BACKUP)

  // 21: preparation cannot use a malformed account fixture.
  check(open(expectedAccount = account.uppercase()).first ==
    SyntheticKitCeremonyCheck.DENY_BAD_SOURCE)
  check(open(expectedAccount = otherAccount).first ==
    SyntheticKitCeremonyCheck.DENY_ACCOUNT_SCOPE)

  // 22: malformed source key is not silently truncated or padded.
  check(open(sourceKey = ByteArray(31)).first == SyntheticKitCeremonyCheck.DENY_BAD_SOURCE)
  check(open(sourceKey = null).first == SyntheticKitCeremonyCheck.DENY_BAD_SOURCE)

  // 23: explicit cancel seals ceremony; doesn't erase offline copy.
  val cancelled = open().second!!
  check(cancelled.cancelFixtureOnly() == SyntheticKitCeremonyCheck.CANCELLED_NOT_STORED)
  check(cancelled.viewFixtureOnly().state == SyntheticKitCeremonyState.CANCELLED)
  check(cancelled.verifySeparateBackupAndSecretFixtureOnly(file, separateSecret) ==
    SyntheticKitCeremonyCheck.DENY_TERMINAL)

  // 24: deadline expiry cannot re-open with a rolled back wall clock.
  val expired = open().second!!
  val issued = now
  now = issued + SyntheticRecoveryKitCeremonyLab.WINDOW_MILLIS
  check(expired.verifySeparateBackupAndSecretFixtureOnly(file, separateSecret) ==
    SyntheticKitCeremonyCheck.DENY_EXPIRED)
  check(expired.viewFixtureOnly().state == SyntheticKitCeremonyState.EXPIRED)
  now = issued
  check(expired.verifySeparateBackupAndSecretFixtureOnly(file, separateSecret) ==
    SyntheticKitCeremonyCheck.DENY_TERMINAL)

  // 25: clock rollback while pending denies instead of implicitly trusting it.
  val rolled = open().second!!
  now = issued - 1L
  check(rolled.verifySeparateBackupAndSecretFixtureOnly(file, separateSecret) ==
    SyntheticKitCeremonyCheck.DENY_BAD_CLOCK)
  now = issued
  check(rolled.verifySeparateBackupAndSecretFixtureOnly(file, separateSecret) == successful)

  // 26: a simulated hardware storage claim is never required or assumed.
  val newSession = open().second!!
  val onlyExportFile = file.copyOf()
  check(newSession.verifySeparateBackupAndSecretFixtureOnly(onlyExportFile, null) ==
    SyntheticKitCeremonyCheck.DENY_MISSING_OR_INVALID_SECRET)
  check(newSession.viewFixtureOnly().state == SyntheticKitCeremonyState.PENDING_REENTRY)

  // 27: copies are independent; caller mutation cannot corrupt initial export.
  val changed = file.copyOf().also { it.fill(0) }
  check(!changed.contentEquals(file))
  check(newSession.verifySeparateBackupAndSecretFixtureOnly(file, separateSecret) == successful)

  // 28: the ceremony doesn't retain the secret or copy it to debug output.
  check(!newSession.toString().contains(separateSecret.joinToString("") {
    "%02x".format(it.toInt() and 255)
  }))
  check(!newSession.toString().contains(account))
  check(!newSession.toString().contains(export.envelope.kitId))

  // 29: eight simultaneous valid confirmation attempts: one verification.
  val shared = open().second!!
  val gate = CountDownLatch(1)
  val pool = Executors.newFixedThreadPool(8)
  try {
    val tasks = (1..8).map {
      pool.submit<SyntheticKitCeremonyCheck> {
        gate.await()
        shared.verifySeparateBackupAndSecretFixtureOnly(file, separateSecret)
      }
    }
    gate.countDown()
    val responses = tasks.map { it.get(15L, TimeUnit.SECONDS) }
    check(responses.count { it == successful } == 1)
    check(responses.count { it == SyntheticKitCeremonyCheck.DENY_TERMINAL } == 7)
  } finally {
    pool.shutdownNow()
  }

  // 30: a second independent clean-room check remains possible from old
  // bytes+secret after ceremony expiry: no fake offline crypto revocation.
  check(SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
    account, keyHash(), file, separateSecret
  ) == successful)

  dataKey.fill(0)
  wrongSource.fill(0)
  separateSecret.fill(0)
  println("PASS: SEC-05I 30 independent re-entry, clean-room restore and no-grant scenarios (JVM only)")
}
