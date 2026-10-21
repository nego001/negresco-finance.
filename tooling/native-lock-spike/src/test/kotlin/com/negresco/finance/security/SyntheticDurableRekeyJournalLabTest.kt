package com.negresco.finance.security

import java.nio.file.Files
import java.nio.file.Path
import java.nio.channels.FileChannel
import java.nio.file.StandardOpenOption
import java.security.SecureRandom
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** SEC-05K: restart/crash matrix with disposable encrypted data only. */
internal fun runSyntheticDurableRekeyJournalScenarios() {
  val random = SecureRandom()
  val account = "c".repeat(32)
  val otherAccount = "d".repeat(32)
  var checks = 0
  fun verify(ok: Boolean, reason: String) {
    check(ok) { "SEC-05K: $reason" }
    checks++
  }
  fun randomKey() = ByteArray(32).also { random.nextBytes(it) }
  data class Scenario(
    val before: SyntheticRekeySnapshotLab,
    val after: SyntheticRekeySnapshotLab,
    val oldFile: ByteArray, val newFile: ByteArray,
    val oldSecret: ByteArray, val newSecret: ByteArray,
    val oldKey: ByteArray
  )
  fun scenario(): Scenario {
    val dek = randomKey()
    val first = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(
      account, dek, 1L, 2L
    )
    val firstFile = SyntheticPortableRecoveryEnvelopeLab.exportEnvelopeBytesFixtureOnly(
      first.envelope
    )
    val lab = SyntheticCompromisedKitRotationLab.seedFixtureOnly(
      account, dek, first, linkedMapOf(
        "game" to "synthetic game purchase".toByteArray(),
        "subscription" to "synthetic subscription".toByteArray()
      )
    )
    val before = lab.snapshotFixtureOnly()
    val rotated = lab.rotateCompromisedKitFixtureOnly(
      account, before.kitId, firstFile, first.recoverySecretCopyForFixtureOnly()
    )
    check(rotated.check == SyntheticRekeyCheck.REKEYED_FIXTURE_ONLY_NOT_AUTHORIZATION)
    val nextKit = rotated.freshKitFixtureOnly!!
    return Scenario(
      before, lab.snapshotFixtureOnly(), firstFile, lab.encryptedBackupFixtureOnly(),
      first.recoverySecretCopyForFixtureOnly(), nextKit.recoverySecretCopyForFixtureOnly(), dek
    )
  }
  fun root() = Files.createTempDirectory("negresco-sec05k-disposable-")
  fun journal(dir: Path) = SyntheticDurableRekeyJournalLab(dir)
  fun seed(dir: Path, s: Scenario) =
    journal(dir).seedFixtureOnly(s.before, s.oldFile)
  fun prepare(
    dir: Path, s: Scenario, crash: SyntheticJournalCrashLab = SyntheticJournalCrashLab.NONE
  ) = journal(dir).prepareFixtureOnly(
    account, s.before.kitId, s.oldSecret, s.after, s.newFile, s.newSecret, crash
  )
  fun commit(
    dir: Path, s: Scenario, crash: SyntheticJournalCrashLab = SyntheticJournalCrashLab.NONE
  ) = journal(dir).commitFixtureOnly(
    account, s.before.kitId, s.newFile, s.newSecret, crash
  )
  fun checkOld(result: SyntheticJournalResultLab, s: Scenario, reason: String) {
    verify(result.snapshotFixtureOnly!!.kitId == s.before.kitId, reason)
  }
  fun checkNew(result: SyntheticJournalResultLab, s: Scenario, reason: String) {
    verify(result.snapshotFixtureOnly!!.kitId == s.after.kitId, reason)
  }
  /**
   * A completely new JVM starts without the parent's DEK/kit secrets.
   * Only a disposable directory is passed as a process argument.
   */
  fun recoverInIndependentJvm(dir: Path): SyntheticJournalCheckLab {
    val os = System.getProperty("os.name").lowercase()
    val javaBinary = java.nio.file.Paths.get(
      System.getProperty("java.home"), "bin",
      if (os.contains("win")) "java.exe" else "java"
    )
    val child = ProcessBuilder(
      javaBinary.toString(),
      "-cp", System.getProperty("java.class.path"),
      "com.negresco.finance.security.NativeLockCoordinatorTestKt",
      "--sec05k-recover-fixture-only",
      dir.toAbsolutePath().toString()
    ).redirectErrorStream(true).start()
    if (!child.waitFor(30L, TimeUnit.SECONDS)) {
      child.destroyForcibly()
      child.waitFor(5L, TimeUnit.SECONDS)
      error("SEC-05K separate JVM recovery timed out")
    }
    val output = child.inputStream.bufferedReader().use { it.readText() }
    check(child.exitValue() == 0) { "SEC-05K child process failed (exit ${child.exitValue()})" }
    val token = "SEC05K_CHILD_RESULT="
    val line = output.lineSequence().firstOrNull { it.startsWith(token) }
      ?: error("SEC-05K child did not return its recovery outcome")
    return SyntheticJournalCheckLab.valueOf(line.removePrefix(token).trim())
  }

  /**
   * Write ONLY the portable encrypted envelope to a physically separate test
   * directory. This is not proof the user safely preserved the detached secret.
   */
  fun exportBackupFixtureOnly(s: Scenario): Path {
    val destination = Files.createTempDirectory("sec05k-detached-export-fixture-")
      .resolve("portable-envelope")
    FileChannel.open(destination,
      StandardOpenOption.WRITE, StandardOpenOption.CREATE_NEW).use { channel ->
      val buffer = java.nio.ByteBuffer.wrap(s.newFile)
      while (buffer.hasRemaining()) channel.write(buffer)
      channel.force(true)
    }
    check(Files.readAllBytes(destination).contentEquals(s.newFile))
    return destination
  }

  /**
   * The child executes the commit then calls Runtime.halt(73) at a controlled
   * checkpoint. The 32-byte disposable secret is piped on stdin, never argv.
   */
  fun hardStopCommitInIndependentJvm(
    dir: Path, s: Scenario, export: Path,
    afterActive: Boolean = false, secret: ByteArray = s.newSecret
  ): Int {
    val os = System.getProperty("os.name").lowercase()
    val javaBinary = java.nio.file.Paths.get(
      System.getProperty("java.home"), "bin",
      if (os.contains("win")) "java.exe" else "java"
    )
    val mode = if (afterActive)
      "--sec05k-commit-halt-after-active-fixture-only"
    else "--sec05k-commit-halt-after-marker-fixture-only"
    val child = ProcessBuilder(
      javaBinary.toString(),
      "-cp", System.getProperty("java.class.path"),
      "com.negresco.finance.security.NativeLockCoordinatorTestKt",
      mode, dir.toAbsolutePath().toString(), account, s.before.kitId,
      export.toAbsolutePath().toString()
    ).redirectErrorStream(true).start()
    child.outputStream.use { it.write(secret); it.flush() }
    if (!child.waitFor(30L, TimeUnit.SECONDS)) {
      child.destroyForcibly()
      child.waitFor(5L, TimeUnit.SECONDS)
      error("SEC-05K abruptly terminated JVM did not exit")
    }
    val output = child.inputStream.bufferedReader().use { it.readText() }
    val exit = child.exitValue()
    check(exit == 4 || exit == 73) {
      "SEC-05K hard-stop child failed unexpectedly (exit $exit): ${output.take(160)}"
    }
    return exit
  }

  /**
   * Fresh JVM proof checks the post-restart ACTIVE ciphertext against a detached
   * encrypted portable export plus a separately piped, disposable test secret.
   * Parent DEKs are deliberately not passed to the child process.
   */
  fun verifyDetachedInIndependentJvm(
    dir: Path, s: Scenario, export: Path,
    expectedAccount: String = account,
    expectedKit: String = s.after.kitId,
    expectedVersion: Long = s.after.version,
    expectedGeneration: Long = s.after.generation,
    secret: ByteArray = s.newSecret
  ): SyntheticJournalCheckLab {
    val os = System.getProperty("os.name").lowercase()
    val javaBinary = java.nio.file.Paths.get(
      System.getProperty("java.home"), "bin",
      if (os.contains("win")) "java.exe" else "java"
    )
    val child = ProcessBuilder(
      javaBinary.toString(),
      "-cp", System.getProperty("java.class.path"),
      "com.negresco.finance.security.NativeLockCoordinatorTestKt",
      "--sec05k-verify-detached-fixture-only",
      dir.toAbsolutePath().toString(), expectedAccount, expectedKit,
      expectedVersion.toString(), expectedGeneration.toString(),
      export.toAbsolutePath().toString()
    ).redirectErrorStream(true).start()
    child.outputStream.use { output ->
      output.write(secret)
      output.flush()
    }
    if (!child.waitFor(30L, TimeUnit.SECONDS)) {
      child.destroyForcibly()
      child.waitFor(5L, TimeUnit.SECONDS)
      error("SEC-05K detached backup proof child timed out")
    }
    val out = child.inputStream.bufferedReader().use { it.readText() }
    check(child.exitValue() == 0) {
      "SEC-05K detached backup verification JVM failed (exit ${child.exitValue()})"
    }
    val tag = "SEC05K_DETACHED_PROOF="
    val outcome = out.lineSequence().firstOrNull { it.startsWith(tag) }
      ?: error("SEC-05K detached verification JVM returned no status")
    return SyntheticJournalCheckLab.valueOf(outcome.removePrefix(tag).trim())
  }

  /**
   * JVM process ignoring the migration.lock, constrained to disposable test
   * candidate files. Demonstrates OS FileLock is advisory against hostile code.
   */
  fun mutatePendingWithoutLockInIndependentJvm(dir: Path) {
    val javaBinary = java.nio.file.Paths.get(
      System.getProperty("java.home"), "bin",
      if (System.getProperty("os.name").lowercase().contains("win")) "java.exe" else "java"
    )
    val child = ProcessBuilder(
      javaBinary.toString(), "-cp", System.getProperty("java.class.path"),
      "com.negresco.finance.security.NativeLockCoordinatorTestKt",
      "--sec05k-noncooperative-candidate-fixture-only", dir.toAbsolutePath().toString()
    ).redirectErrorStream(true).start()
    if (!child.waitFor(30L, TimeUnit.SECONDS)) {
      child.destroyForcibly()
      child.waitFor(5L, TimeUnit.SECONDS)
      error("SEC-05K noncooperative writer JVM timed out")
    }
    val outcome = child.inputStream.bufferedReader().use { it.readText() }
    check(child.exitValue() == 0 &&
      outcome.lineSequence().any {
        it == "SEC05K_NONCOOPERATIVE_CANDIDATE_MUTATED=FIXTURE_ONLY"
      }) { "SEC-05K child writer did not mutate disposable candidate" }
  }

  fun flipFirstByte(path: Path) {
    val data = Files.readAllBytes(path)
    data[0] = (data[0].toInt() xor 1).toByte()
    Files.write(path, data)
  }

  run {
    val s = scenario()
    val dir = root()
    verify(seed(dir, s).check == SyntheticJournalCheckLab.SEEDED_FIXTURE_ONLY,
      "seeds disposable ciphertext")
    checkOld(journal(dir).recoverFixtureOnly(), s, "clean restart retains old generation")
    verify(Files.exists(dir.resolve("active.snapshot")), "active bytes are durable")
    verify(!Files.exists(dir.resolve("migration.journal")), "clean state has no marker")
    verify(seed(dir, s).check == SyntheticJournalCheckLab.DENY_INVALID_OR_STALE,
      "seed cannot overwrite already provisioned state")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    verify(prepare(dir, s, SyntheticJournalCrashLab.AFTER_PENDING_SYNC).check ==
      SyntheticJournalCheckLab.SIMULATED_CRASH, "crash after pending sync")
    verify(Files.exists(dir.resolve("pending.snapshot")), "orphan candidate exists")
    val recovered = journal(dir).recoverFixtureOnly()
    verify(recovered.check == SyntheticJournalCheckLab.CONSISTENT_FIXTURE_ONLY,
      "orphan without journal discards pending")
    checkOld(recovered, s, "orphan never publishes new generation")
    verify(!Files.exists(dir.resolve("pending.snapshot")), "orphan cleaned")
    verify(prepare(dir, s).check == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
      "can safely retry after orphan crash")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    verify(prepare(dir, s, SyntheticJournalCrashLab.AFTER_PREPARE_SYNC).check ==
      SyntheticJournalCheckLab.SIMULATED_CRASH, "crash after PREPARED marker")
    verify(Files.exists(dir.resolve("migration.journal")), "prepared marker durable")
    val recovered = journal(dir).recoverFixtureOnly()
    verify(recovered.check == SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "restarted process rolls back uncommitted state")
    checkOld(recovered, s, "prepared rollback chooses old ciphertext")
    verify(!Files.exists(dir.resolve("pending.snapshot")) &&
      !Files.exists(dir.resolve("migration.journal")), "rollback cleans artifacts")
    verify(prepare(dir, s).check == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
      "rollback is retryable")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    verify(journal(dir).prepareFixtureOnly(otherAccount, s.before.kitId,
      s.oldSecret, s.after, s.newFile, s.newSecret).check ==
      SyntheticJournalCheckLab.DENY_INVALID_OR_STALE, "wrong account denied")
    verify(journal(dir).prepareFixtureOnly(account, s.after.kitId,
      s.oldSecret, s.after, s.newFile, s.newSecret).check ==
      SyntheticJournalCheckLab.DENY_INVALID_OR_STALE, "wrong old kit denied")
    verify(journal(dir).prepareFixtureOnly(account, s.before.kitId,
      randomKey(), s.after, s.newFile, s.newSecret).check ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF, "wrong old secret denied")
    verify(journal(dir).prepareFixtureOnly(account, s.before.kitId,
      s.oldSecret, s.after, s.newFile, randomKey()).check ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF, "wrong new secret denied")
    verify(!Files.exists(dir.resolve("pending.snapshot")), "denied proofs do not persist")
    val mutated = s.after.records.mapValues { (_, record) ->
      val cipher = record.ciphertextCopy()
      cipher[0] = (cipher[0].toInt() xor 1).toByte()
      SyntheticEncryptedRecordLab(record.id, record.version, record.generation,
        record.nonceCopy(), cipher)
    }
    val tampered = SyntheticRekeySnapshotLab(
      s.after.accountId, s.after.kitId, s.after.version, s.after.generation,
      mutated, s.after.retiredKitIds
    )
    verify(journal(dir).prepareFixtureOnly(account, s.before.kitId,
      s.oldSecret, tampered, s.newFile, s.newSecret).check ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF, "AEAD corruption of new ciphertext denied")
    checkOld(journal(dir).recoverFixtureOnly(), s, "tampered prepare leaves old state")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    verify(prepare(dir, s).check == SyntheticJournalCheckLab.DENY_INVALID_OR_STALE,
      "cannot prepare twice while pending")
    verify(journal(dir).commitFixtureOnly(otherAccount, s.before.kitId,
      s.newFile, s.newSecret).check ==
      SyntheticJournalCheckLab.DENY_INVALID_OR_STALE, "wrong account commit denied")
    verify(journal(dir).commitFixtureOnly(account, s.after.kitId,
      s.newFile, s.newSecret).check ==
      SyntheticJournalCheckLab.DENY_INVALID_OR_STALE, "stale expected kit commit denied")
    verify(journal(dir).commitFixtureOnly(account, s.before.kitId,
      s.oldFile, s.newSecret).check ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF, "unrelated backup file denied")
    verify(journal(dir).commitFixtureOnly(account, s.before.kitId,
      s.newFile, randomKey()).check ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF, "wrong new detached secret denied")
    verify(journal(dir).commitFixtureOnly(account, s.before.kitId,
      s.newFile, "123456".toByteArray()).check ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF, "PIN is not backup secret")
    val rollback = journal(dir).recoverFixtureOnly()
    verify(rollback.check == SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "failed approval never moves to commit")
    checkOld(rollback, s, "rejected backup leaves old generation")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    verify(commit(dir, s, SyntheticJournalCrashLab.AFTER_COMMIT_SYNC).check ==
      SyntheticJournalCheckLab.SIMULATED_CRASH, "crash immediately after COMMITTED marker")
    val recovered = journal(dir).recoverFixtureOnly()
    verify(recovered.check == SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "restart must finalize committed migration")
    checkNew(recovered, s, "committed marker chooses new ciphertext")
    val next = SyntheticPortableRecoveryEnvelopeLab.importEnvelopeBytesFixtureOnly(
      s.newFile, account
    ).envelope!!
    val freshKey = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
      next, s.newSecret
    )!!.copyForFixtureOnly()
    try {
      for (record in recovered.snapshotFixtureOnly!!.records.values) {
        verify(SyntheticRecordCipherLab.decryptFixtureOnly(account, record, s.oldKey) == null,
          "retired DEK cannot decrypt committed record")
        val clear = SyntheticRecordCipherLab.decryptFixtureOnly(account, record, freshKey)
        verify(clear != null, "fresh DEK decrypts committed record")
        clear?.fill(0)
      }
    } finally { freshKey.fill(0) }
    checkNew(journal(dir).recoverFixtureOnly(), s, "second restart stays committed")
    verify(prepare(dir, s).check == SyntheticJournalCheckLab.DENY_INVALID_OR_STALE,
      "old kit cannot replay a committed migration")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    verify(commit(dir, s, SyntheticJournalCrashLab.AFTER_ACTIVE_REPLACE).check ==
      SyntheticJournalCheckLab.SIMULATED_CRASH, "crash after active replacement")
    val recovered = journal(dir).recoverFixtureOnly()
    verify(recovered.check == SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "committed active replacement is idempotent")
    checkNew(recovered, s, "no revert after published active")
    verify(!Files.exists(dir.resolve("migration.journal")) &&
      !Files.exists(dir.resolve("pending.snapshot")), "finalize cleans pending and marker")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    val committed = commit(dir, s)
    verify(committed.check == SyntheticJournalCheckLab.COMMITTED_FIXTURE_ONLY_NOT_AUTHORIZATION,
      "normal two-phase publication")
    checkNew(committed, s, "normal commit publishes new ciphertext")
    checkNew(journal(dir).recoverFixtureOnly(), s, "normal commit persists across restart")
    verify(commit(dir, s).check == SyntheticJournalCheckLab.DENY_INVALID_OR_STALE,
      "commit cannot be replayed after cleanup")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s, SyntheticJournalCrashLab.AFTER_PREPARE_SYNC)
    flipFirstByte(dir.resolve("pending.snapshot"))
    verify(journal(dir).recoverFixtureOnly().check ==
      SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "corrupted uncommitted pending can be safely discarded")
    checkOld(journal(dir).recoverFixtureOnly(), s, "rollback keeps original intact")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    commit(dir, s, SyntheticJournalCrashLab.AFTER_COMMIT_SYNC)
    flipFirstByte(dir.resolve("pending.snapshot"))
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "committed missing valid pending must not revert to old")
    verify(Files.exists(dir.resolve("migration.journal")),
      "failed committed recovery retains journal for forensic handling")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    flipFirstByte(dir.resolve("migration.journal"))
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "corrupted journal must fail closed")
    verify(Files.exists(dir.resolve("pending.snapshot")),
      "corrupt journal does not silently discard candidate")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    flipFirstByte(dir.resolve("active.snapshot"))
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "corrupted active state must fail closed")
    verify(prepare(dir, s).check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "cannot migrate corrupted active state")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val pool = Executors.newFixedThreadPool(2)
    val gate = CountDownLatch(1)
    try {
      val tasks = (0 until 2).map {
        pool.submit<SyntheticJournalCheckLab> {
          gate.await()
          prepare(dir, s).check
        }
      }
      gate.countDown()
      val outcomes = tasks.map { it.get(10, TimeUnit.SECONDS) }
      verify(outcomes.count { it == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY } == 1,
        "filesystem lock permits a single staged generation")
      verify(outcomes.all {
        it in setOf(SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
          SyntheticJournalCheckLab.DENY_INVALID_OR_STALE, SyntheticJournalCheckLab.DENY_BUSY)
      }, "competing process cannot replace pending journal")
      verify(journal(dir).recoverFixtureOnly().check ==
        SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK, "race rollback retains old")
    } finally { pool.shutdownNow() }
  }

  // SEC-05K real process boundary: a fresh JVM starts with no parent heap state.
  // These checks complement, but do not replace, power-loss/physical fs QA.
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.CONSISTENT_FIXTURE_ONLY,
      "separate JVM opens durable initial snapshot")
    verify(prepare(dir, s, SyntheticJournalCrashLab.AFTER_PENDING_SYNC).check ==
      SyntheticJournalCheckLab.SIMULATED_CRASH, "separate JVM orphan setup")
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.CONSISTENT_FIXTURE_ONLY,
      "separate JVM removes orphan candidate")
    verify(!Files.exists(dir.resolve("pending.snapshot")),
      "orphan removed by separate JVM")
    prepare(dir, s, SyntheticJournalCrashLab.AFTER_PREPARE_SYNC)
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "separate JVM PREPARED rolls back safely")
    verify(prepare(dir, s).check == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
      "after child rollback, prepare can retry")
    commit(dir, s, SyntheticJournalCrashLab.AFTER_COMMIT_SYNC)
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "separate JVM COMMITTED finalizes new snapshot")
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.CONSISTENT_FIXTURE_ONLY,
      "second child JVM sees consistent committed snapshot")
    checkNew(journal(dir).recoverFixtureOnly(), s,
      "post-child recovery keeps latest generation")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    commit(dir, s, SyntheticJournalCrashLab.AFTER_ACTIVE_REPLACE)
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "child finalizes COMMITTED after active replacement")
    checkNew(journal(dir).recoverFixtureOnly(), s,
      "child cannot return to old generation after active replacement")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    commit(dir, s, SyntheticJournalCrashLab.AFTER_COMMIT_SYNC)
    flipFirstByte(dir.resolve("pending.snapshot"))
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "child process fails closed on torn committed candidate")
    verify(Files.exists(dir.resolve("migration.journal")),
      "cross-process failure retains committed evidence")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s, SyntheticJournalCrashLab.AFTER_PREPARE_SYNC)
    flipFirstByte(dir.resolve("migration.journal"))
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "child process fails closed on damaged journal")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    FileChannel.open(dir.resolve("migration.lock"),
      StandardOpenOption.WRITE, StandardOpenOption.CREATE).use { channel ->
      channel.lock().use {
        verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.DENY_BUSY,
          "independent JVM cannot recover while lock belongs to parent process")
      }
    }
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.CONSISTENT_FIXTURE_ONLY,
      "independent JVM recovers after OS process lock released")
  }

  // Actual abrupt child-process termination AFTER durable decision points.
  // It is NOT a hardware power-loss simulation or proof of backup retention.
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val export = exportBackupFixtureOnly(s)
    verify(prepare(dir, s).check == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
      "hard-stop setup successfully prepared migration")
    verify(hardStopCommitInIndependentJvm(dir, s, export) == 73,
      "fresh JVM stops abruptly after COMMITTED marker sync")
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "new JVM rolls forward after previous JVM hard halt at commit marker")
    checkNew(journal(dir).recoverFixtureOnly(), s,
      "hard-halted commit marker does not lose new ciphertext")
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.CONSISTENT_FIXTURE_ONLY,
      "post-hard-halt restarted process is idempotent")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val export = exportBackupFixtureOnly(s)
    prepare(dir, s)
    verify(hardStopCommitInIndependentJvm(dir, s, export, afterActive = true) == 73,
      "fresh JVM stops abruptly after active replacement and sync")
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "new JVM recognizes committed active snapshot after hard halt")
    checkNew(journal(dir).recoverFixtureOnly(), s,
      "hard-halted active replacement does not restore old ciphertext")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val export = exportBackupFixtureOnly(s)
    prepare(dir, s)
    verify(hardStopCommitInIndependentJvm(dir, s, export, secret = randomKey()) == 4,
      "hard-stop command refuses invalid detached secret and does NOT hard-halt")
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "invalid detached secret leaves PREPARED rollback intact")
    checkOld(journal(dir).recoverFixtureOnly(), s,
      "failed backup secret cannot advance to COMMITTED")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val export = exportBackupFixtureOnly(s)
    prepare(dir, s)
    val corrupt = Files.readAllBytes(export)
    corrupt[0] = (corrupt[0].toInt() xor 1).toByte()
    Files.write(export, corrupt)
    verify(hardStopCommitInIndependentJvm(dir, s, export) == 4,
      "corrupted detached export does not authorize COMMITTED")
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "corrupt backup file leaves old generation usable")
  }

  // A detached recovery kit must decrypt every NEW record after the
  // committing JVM has exited and another JVM has completed journal recovery.
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val export = exportBackupFixtureOnly(s)
    prepare(dir, s)
    verify(hardStopCommitInIndependentJvm(dir, s, export) == 73,
      "separate child halts after sync of new DEK journal")
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "independent JVM finishes interrupted durable commit")
    verify(verifyDetachedInIndependentJvm(dir, s, export) ==
      SyntheticJournalCheckLab.VERIFIED_DETACHED_BACKUP_FIXTURE_ONLY,
      "fresh third JVM decrypts every current record via detached kit and export")
    verify(verifyDetachedInIndependentJvm(dir, s, export, secret = randomKey()) ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF,
      "wrong detached recovery secret cannot prove ciphertext")
    verify(verifyDetachedInIndependentJvm(dir, s, export, expectedGeneration = s.before.generation) ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF,
      "rollback/stale expected generation rejected after commit")
    verify(verifyDetachedInIndependentJvm(dir, s, export, expectedKit = s.before.kitId) ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF,
      "retired recovery kit rejected as current")
    verify(verifyDetachedInIndependentJvm(dir, s, export, expectedAccount = otherAccount) ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF,
      "detached kit cannot cross fixture account boundary")
    verify(verifyDetachedInIndependentJvm(dir, s, export, secret = "123456".toByteArray()) ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF,
      "short human PIN cannot substitute for 256-bit recovery secret")
    checkNew(journal(dir).recoverFixtureOnly(), s,
      "failed detached proofs never modify committed snapshot")
    verify(verifyDetachedInIndependentJvm(dir, s, export) ==
      SyntheticJournalCheckLab.VERIFIED_DETACHED_BACKUP_FIXTURE_ONLY,
      "valid detached recovery remains repeatable after denied proofs")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val export = exportBackupFixtureOnly(s)
    prepare(dir, s, SyntheticJournalCrashLab.AFTER_PREPARE_SYNC)
    verify(verifyDetachedInIndependentJvm(dir, s, export) ==
      SyntheticJournalCheckLab.DENY_INVALID_OR_STALE,
      "outstanding PREPARED journal blocks detached proof until recovery")
    verify(recoverInIndependentJvm(dir) ==
      SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "prepared state rolls back before further backup proofs")
    verify(verifyDetachedInIndependentJvm(dir, s, export) ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF,
      "uncommitted backup cannot prove old active generation as new")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val export = exportBackupFixtureOnly(s)
    prepare(dir, s)
    commit(dir, s)
    val corrupt = Files.readAllBytes(export)
    corrupt[0] = (corrupt[0].toInt() xor 1).toByte()
    Files.write(export, corrupt)
    verify(verifyDetachedInIndependentJvm(dir, s, export) ==
      SyntheticJournalCheckLab.DENY_RECOVERY_PROOF,
      "altered detached envelope cannot prove ciphertext after restart")
    val restored = exportBackupFixtureOnly(s)
    verify(verifyDetachedInIndependentJvm(dir, s, restored) ==
      SyntheticJournalCheckLab.VERIFIED_DETACHED_BACKUP_FIXTURE_ONLY,
      "uncorrupted export recovers again after backup-file tamper")
    flipFirstByte(dir.resolve("active.snapshot"))
    verify(verifyDetachedInIndependentJvm(dir, s, restored) ==
      SyntheticJournalCheckLab.FAIL_CLOSED,
      "corrupted durable active ciphertext fails closed even with valid recovery kit")
  }

  // Storage-path hardening: no snapshot, pending journal, lock file or fixture
  // directory may resolve through an attacker-controlled symbolic link.
  // This verifies fail-closed behavior in the JVM lab, NOT race-free filesystem
  // integrity against an active adversary who can rewrite parent directories.
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val outside = root().resolve("external-valid-snapshot")
    val original = Files.readAllBytes(dir.resolve("active.snapshot"))
    Files.write(outside, original)
    Files.delete(dir.resolve("active.snapshot"))
    Files.createSymbolicLink(dir.resolve("active.snapshot"), outside)
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "symlink active snapshot cannot be followed even if target is valid")
    verify(Files.readAllBytes(outside).contentEquals(original),
      "external snapshot target is unchanged on rejected symlink")
    Files.delete(dir.resolve("active.snapshot"))
    Files.write(dir.resolve("active.snapshot"), original)
    checkOld(journal(dir).recoverFixtureOnly(), s,
      "recovered after removing active snapshot symlink")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s, SyntheticJournalCrashLab.AFTER_PREPARE_SYNC)
    val outside = root().resolve("external-pending-candidate")
    Files.copy(dir.resolve("pending.snapshot"), outside)
    Files.delete(dir.resolve("pending.snapshot"))
    Files.createSymbolicLink(dir.resolve("pending.snapshot"), outside)
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "independent JVM refuses symlinked pending generation")
    Files.delete(dir.resolve("pending.snapshot"))
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "legitimate PREPARED rollback works after symlink is removed")
    checkOld(journal(dir).recoverFixtureOnly(), s,
      "symlinked pending snapshot never publishes a generation")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s, SyntheticJournalCrashLab.AFTER_PREPARE_SYNC)
    val oldJournal = Files.readAllBytes(dir.resolve("migration.journal"))
    val outside = root().resolve("external-journal-marker")
    Files.write(outside, oldJournal)
    Files.delete(dir.resolve("migration.journal"))
    Files.createSymbolicLink(dir.resolve("migration.journal"), outside)
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "symlinked COMMIT/PREPARE marker is never followed")
    Files.delete(dir.resolve("migration.journal"))
    Files.write(dir.resolve("migration.journal"), oldJournal)
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "restored real journal marker permits safe rollback")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val external = root().resolve("external-lock-target")
    val marker = byteArrayOf(11, 22, 33, 44)
    Files.write(external, marker)
    Files.delete(dir.resolve("migration.lock"))
    Files.createSymbolicLink(dir.resolve("migration.lock"), external)
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "symlinked lock cannot acquire/redirect lock outside fixture")
    verify(Files.readAllBytes(external).contentEquals(marker),
      "rejecting a lock alias does not change its target")
    Files.delete(dir.resolve("migration.lock"))
    checkOld(journal(dir).recoverFixtureOnly(), s,
      "real lock is recreated safely after alias removal")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val alias = root().resolve("aliased-state-directory")
    Files.createSymbolicLink(alias, dir)
    verify(journal(alias).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "symlinked fixture root directory cannot be trusted")
    checkOld(journal(dir).recoverFixtureOnly(), s,
      "real directory is still readable after rejected alias")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val dangling = dir.resolve("pending.snapshot")
    Files.createSymbolicLink(dangling, dir.resolve("does-not-exist.snapshot"))
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "dangling pending alias is not misclassified as an absent orphan")
    Files.delete(dangling)
    checkOld(journal(dir).recoverFixtureOnly(), s,
      "recovery resumes only after dangling alias removal")
  }

  // SEC-05K publication boundary: a candidate can change after the first
  // valid checksum check but before ATOMIC_MOVE. Preserve the COMMITTED marker
  // and fail closed rather than publishing unverified bytes.
  run {
    val scenario = scenario()
    val dir = root()
    seed(dir, scenario)
    val old = Files.readAllBytes(dir.resolve("active.snapshot"))
    prepare(dir, scenario)
    verify(commit(dir, scenario,
      SyntheticJournalCrashLab.TAMPER_PENDING_BEFORE_PUBLISH_FIXTURE_ONLY).check ==
      SyntheticJournalCheckLab.FAIL_CLOSED,
      "tamper after durable commit decision is rejected before candidate promotion")
    verify(Files.readAllBytes(dir.resolve("active.snapshot")).contentEquals(old),
      "old active bytes remain untouched when staged candidate changes")
    verify(Files.exists(dir.resolve("migration.journal")),
      "COMMITTED journal remains after detecting a changed staged candidate")
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "recovery does not silently roll back the corrupted COMMITTED candidate")
  }
  run {
    val scenario = scenario()
    val dir = root()
    seed(dir, scenario)
    prepare(dir, scenario)
    verify(commit(dir, scenario,
      SyntheticJournalCrashLab.TAMPER_ACTIVE_AFTER_PUBLISH_FIXTURE_ONLY).check ==
      SyntheticJournalCheckLab.FAIL_CLOSED,
      "post-promotion corruption is detected before journal cleanup")
    verify(Files.exists(dir.resolve("migration.journal")),
      "COMMITTED decision stays durable when published ciphertext is corrupted")
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "broken published bytes cannot become a successful recovered generation")
  }
  run {
    val scenario = scenario()
    val dir = root()
    seed(dir, scenario)
    prepare(dir, scenario)
    verify(commit(dir, scenario).check ==
      SyntheticJournalCheckLab.COMMITTED_FIXTURE_ONLY_NOT_AUTHORIZATION,
      "normal commit still succeeds with post-publication attestation")
    verify(!Files.exists(dir.resolve("migration.journal")),
      "successful verified commit safely removes journal")
    verify(journal(dir).recoverFixtureOnly().check ==
      SyntheticJournalCheckLab.CONSISTENT_FIXTURE_ONLY,
      "verified ciphertext remains consistent in later JVM fixture")
  }

  // Deterministic race immediately AFTER the final hash check: a writer
  // that ignores FileLock can change pending just before the atomic rename.
  // Publication must fail closed and retain the COMMITTED marker.
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    verify(commit(dir, s,
      SyntheticJournalCrashLab.TAMPER_PENDING_AFTER_FINAL_CHECK_FIXTURE_ONLY).check ==
      SyntheticJournalCheckLab.FAIL_CLOSED,
      "mutation after last pre-move checksum fails post-publish attestation")
    verify(Files.exists(dir.resolve("migration.journal")),
      "COMMITTED marker retained after a corrupted candidate was promoted")
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "failed attestation cannot be silently treated as a valid commit")
    verify(!Files.exists(dir.resolve("pending.snapshot")),
      "failed post-publish attestation does not manufacture a fresh candidate")
  }
  // Real independent JVM deliberately skips OS advisory lock. Catch the
  // changed bytes at commit and prove PREPARED rollback remains safe.
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    FileChannel.open(dir.resolve("migration.lock"),
      StandardOpenOption.CREATE, StandardOpenOption.WRITE).use { channel ->
      channel.lock().use {
        mutatePendingWithoutLockInIndependentJvm(dir)
      }
    }
    verify(commit(dir, s).check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "commit rejects external noncooperative mutation of PREPARED candidate")
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "PREPARED rollback discards concurrently tampered candidate")
    checkOld(journal(dir).recoverFixtureOnly(), s,
      "original generation survives noncooperative JVM mutation before commit")
    verify(prepare(dir, s).check == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
      "after rollback a clean candidate can be staged again")
    verify(commit(dir, s).check ==
      SyntheticJournalCheckLab.COMMITTED_FIXTURE_ONLY_NOT_AUTHORIZATION,
      "legitimate retry succeeds after hostile test candidate removed")
  }
  // Once COMMITTED is durable, a noncooperative writer must NOT trigger an
  // incorrect rollback to the old generation when new pending is corrupted.
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    prepare(dir, s)
    verify(commit(dir, s, SyntheticJournalCrashLab.AFTER_COMMIT_SYNC).check ==
      SyntheticJournalCheckLab.SIMULATED_CRASH,
      "durable COMMITTED state prepared for independent-writer rehearsal")
    FileChannel.open(dir.resolve("migration.lock"),
      StandardOpenOption.CREATE, StandardOpenOption.WRITE).use { channel ->
      channel.lock().use {
        mutatePendingWithoutLockInIndependentJvm(dir)
      }
    }
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "COMMITTED recovery rejects candidate corrupted by JVM ignoring lock")
    verify(Files.exists(dir.resolve("migration.journal")),
      "COMMITTED recovery preserves evidence after foreign mutation")
    verify(Files.exists(dir.resolve("active.snapshot")),
      "failed COMMITTED recovery leaves encrypted snapshot for manual repair")
  }

  // SEC-05K missing/truncated/oversize matrix. Never turn a lost snapshot
  // into a fresh provisioning with a different owner, generation or kit.
  for (size in listOf(0, 36, 131073)) {
    val fixture = scenario()
    val dir = root()
    seed(dir, fixture)
    val file = dir.resolve("active.snapshot")
    val original = Files.readAllBytes(file)
    Files.write(file, ByteArray(size))
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "invalid active file size $size fails closed across JVM restart")
    verify(prepare(dir, fixture).check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "invalid active file size $size cannot start a rekey")
    verify(Files.size(file) == size.toLong(),
      "invalid active file size $size is never overwritten by recovery")
    Files.write(file, original)
    checkOld(journal(dir).recoverFixtureOnly(), fixture,
      "restoring authentic active ciphertext after size $size resumes")
  }
  run {
    val fixture = scenario()
    val dir = root()
    seed(dir, fixture)
    val guard = dir.resolve("provisioned.guard")
    val file = dir.resolve("active.snapshot")
    val original = Files.readAllBytes(file)
    verify(Files.exists(guard), "durable provision marker exists after first seeding")
    Files.delete(file)
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "missing provisioned snapshot cannot be treated as a clean restart")
    verify(seed(dir, fixture).check == SyntheticJournalCheckLab.DENY_INVALID_OR_STALE,
      "missing active with durable provision marker is denied re-provision")
    verify(!Files.exists(file), "failed re-provision does not recreate missing active")
    Files.write(file, original)
    checkOld(journal(dir).recoverFixtureOnly(), fixture,
      "restoring saved ciphertext resolves lost active without new provisioning")
  }
  run {
    val fixture = scenario()
    val dir = root()
    seed(dir, fixture)
    val guard = dir.resolve("provisioned.guard")
    val original = Files.readAllBytes(guard)
    flipFirstByte(guard)
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "corrupted provision marker prevents normal recovery")
    verify(seed(dir, fixture).check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "corrupted provision marker cannot be replaced through seed")
    Files.write(guard, original)
    checkOld(journal(dir).recoverFixtureOnly(), fixture,
      "restoring valid marker allows consistent read of existing ciphertext")
    Files.delete(guard)
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "absent provision marker with surviving active is not trusted")
    Files.write(guard, original)
    checkOld(journal(dir).recoverFixtureOnly(), fixture,
      "marker restoration permits consistent recovery without changing records")
  }
  // An uncommitted candidate is safely disposable; a damaged COMMITTED
  // candidate is NOT. The latter retains the durable decision for repair.
  for (size in listOf(0, 36, 131073)) {
    val fixture = scenario()
    val dir = root()
    seed(dir, fixture)
    prepare(dir, fixture, SyntheticJournalCrashLab.AFTER_PREPARE_SYNC)
    Files.write(dir.resolve("pending.snapshot"), ByteArray(size))
    verify(recoverInIndependentJvm(dir) ==
      SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "PREPARED may discard malformed pending size $size")
    checkOld(journal(dir).recoverFixtureOnly(), fixture,
      "malformed uncommitted size $size never publishes a generation")
  }
  for (size in listOf(0, 36, 131073)) {
    val fixture = scenario()
    val dir = root()
    seed(dir, fixture)
    prepare(dir, fixture)
    commit(dir, fixture, SyntheticJournalCrashLab.AFTER_COMMIT_SYNC)
    val file = dir.resolve("pending.snapshot")
    val original = Files.readAllBytes(file)
    Files.write(file, ByteArray(size))
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "COMMITTED candidate malformed size $size must fail closed")
    verify(Files.exists(dir.resolve("migration.journal")),
      "COMMITTED decision must survive malformed pending size $size")
    Files.write(file, original)
    verify(recoverInIndependentJvm(dir) ==
      SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "restored valid COMMITTED candidate $size rolls forward, never back")
    checkNew(journal(dir).recoverFixtureOnly(), fixture,
      "only the new generation is active after restoring size $size")
  }
  run {
    val fixture = scenario()
    val dir = root()
    seed(dir, fixture)
    prepare(dir, fixture)
    commit(dir, fixture, SyntheticJournalCrashLab.AFTER_COMMIT_SYNC)
    val file = dir.resolve("pending.snapshot")
    val original = Files.readAllBytes(file)
    Files.delete(file)
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "missing COMMITTED pending cannot silently restore old active generation")
    verify(Files.exists(dir.resolve("migration.journal")),
      "missing candidate does not erase committed decision")
    Files.write(file, original)
    verify(recoverInIndependentJvm(dir) ==
      SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "restoring missing candidate permits finishing prior COMMITTED decision")
    checkNew(journal(dir).recoverFixtureOnly(), fixture,
      "recovered missing candidate promotes only the committed generation")
  }
  for (size in listOf(0, 36, 131073)) {
    val fixture = scenario()
    val dir = root()
    seed(dir, fixture)
    prepare(dir, fixture, SyntheticJournalCrashLab.AFTER_PREPARE_SYNC)
    val file = dir.resolve("migration.journal")
    val original = Files.readAllBytes(file)
    Files.write(file, ByteArray(size))
    verify(recoverInIndependentJvm(dir) == SyntheticJournalCheckLab.FAIL_CLOSED,
      "malformed journal size $size does not guess PREPARED or COMMITTED")
    verify(Files.exists(dir.resolve("pending.snapshot")),
      "malformed journal size $size does not discard candidate")
    Files.write(file, original)
    verify(recoverInIndependentJvm(dir) ==
      SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK,
      "restoring valid journal size $size resumes safe PREPARED rollback")
    checkOld(journal(dir).recoverFixtureOnly(), fixture,
      "journal size $size recovery leaves original generation active")
  }

  // Detached authenticated generation witness: HMAC key and witness file are
  // outside the journal fixture. This is NOT an actual independent service,
  // hardware monotonic counter, authenticated owner or physical backup.
  fun witnessState(dir: Path, snapshot: SyntheticRekeySnapshotLab) =
    SyntheticWitnessStateLab(
      snapshot.accountId, snapshot.kitId, snapshot.version, snapshot.generation,
      Files.readAllBytes(dir.resolve("active.snapshot"))
    )
  fun witness(dir: Path, root: Path) =
    SyntheticDetachedGenerationWitnessLab(dir, root)

  run {
    val s = scenario()
    val dir = root()
    val remote = root()
    val key = randomKey()
    seed(dir, s)
    val guard = witness(dir, remote)
    val old = witnessState(dir, s.before)
    verify(guard.bootstrapFixtureOnly(old, key) ==
      SyntheticWitnessCheckLab.BOOTSTRAPPED_FIXTURE_ONLY,
      "external fixture witness enrolled initial encrypted generation")
    verify(guard.verifyFixtureOnly(old, key) ==
      SyntheticWitnessCheckLab.VERIFIED_FIXTURE_ONLY,
      "separate witness authenticates original ciphertext generation")
    val originalCipher = old.ciphertextFile.copyOf()
    prepare(dir, s)
    commit(dir, s)
    val fresh = witnessState(dir, s.after)
    verify(guard.verifyFixtureOnly(fresh, key) ==
      SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT,
      "new local generation is untrusted until external witness advances")
    verify(guard.advanceFixtureOnly(old, fresh, key) ==
      SyntheticWitnessCheckLab.ADVANCED_FIXTURE_ONLY,
      "witness advances only one expected version and generation")
    verify(guard.verifyFixtureOnly(fresh, key) ==
      SyntheticWitnessCheckLab.VERIFIED_FIXTURE_ONLY,
      "post-commit ciphertext hash matches authenticated external receipt")
    verify(guard.verifyFixtureOnly(old, key) ==
      SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT,
      "old generation blocked while newer witness retained")
    verify(guard.advanceFixtureOnly(old, fresh, key) ==
      SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT,
      "replaying old advance request cannot lower external generation")
    verify(guard.bootstrapFixtureOnly(old, key) ==
      SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT,
      "existing generation witness cannot be silently reenrolled")
    verify(guard.verifyFixtureOnly(fresh, randomKey()) ==
      SyntheticWitnessCheckLab.FAIL_CLOSED,
      "wrong MAC key is rejected even with intact fixture snapshot")
    val active = dir.resolve("active.snapshot")
    Files.write(active, originalCipher)
    verify(guard.verifyFixtureOnly(witnessState(dir, s.before), key) ==
      SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT,
      "replayed old ciphertext is detected by independently retained witness")
    Files.write(active, fresh.ciphertextFile)
    verify(guard.verifyFixtureOnly(witnessState(dir, s.after), key) ==
      SyntheticWitnessCheckLab.VERIFIED_FIXTURE_ONLY,
      "restored new ciphertext passes external generation check")
  }
  run {
    val s = scenario()
    val dir = root()
    val remote = root()
    val key = randomKey()
    seed(dir, s)
    val guard = witness(dir, remote)
    val old = witnessState(dir, s.before)
    verify(guard.bootstrapFixtureOnly(old, key) ==
      SyntheticWitnessCheckLab.BOOTSTRAPPED_FIXTURE_ONLY,
      "coordinated wipe fixture starts with authentic old witness")
    prepare(dir, s)
    commit(dir, s)
    val fresh = witnessState(dir, s.after)
    guard.advanceFixtureOnly(old, fresh, key)
    Files.delete(dir.resolve("active.snapshot"))
    Files.delete(dir.resolve("provisioned.guard"))
    verify(journal(dir).recoverFixtureOnly().check == SyntheticJournalCheckLab.FAIL_CLOSED,
      "missing local journal snapshot is not considered recovered")
    val reset = scenario()
    verify(seed(dir, reset).check == SyntheticJournalCheckLab.SEEDED_FIXTURE_ONLY,
      "local guard alone cannot detect full replacement when wiped with active")
    verify(guard.verifyFixtureOnly(witnessState(dir, reset.before), key) ==
      SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT,
      "external witness detects locally reseeded state after paired file wipe")
    verify(guard.bootstrapFixtureOnly(witnessState(dir, reset.before), key) ==
      SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT,
      "existing witness prevents silent trusted bootstrap after paired wipe")
    verify(guard.verifyFixtureOnly(fresh, key) ==
      SyntheticWitnessCheckLab.VERIFIED_FIXTURE_ONLY,
      "external witness still recognizes the previous committed ciphertext")
  }
  run {
    val s = scenario()
    val dir = root()
    val remote = root()
    val key = randomKey()
    seed(dir, s)
    val state = witnessState(dir, s.before)
    val guard = witness(dir, remote)
    verify(guard.verifyFixtureOnly(state, key) ==
      SyntheticWitnessCheckLab.DENY_MISSING_WITNESS,
      "read-only verification refuses missing detached authority")
    guard.bootstrapFixtureOnly(state, key)
    val receipt = remote.resolve("generation.witness")
    val original = Files.readAllBytes(receipt)
    flipFirstByte(receipt)
    verify(guard.verifyFixtureOnly(state, key) ==
      SyntheticWitnessCheckLab.FAIL_CLOSED,
      "tampered signed generation receipt fails HMAC verification")
    Files.write(receipt, original)
    verify(guard.verifyFixtureOnly(state, key) ==
      SyntheticWitnessCheckLab.VERIFIED_FIXTURE_ONLY,
      "restoring authentic receipt preserves generation proof")
    Files.delete(receipt)
    verify(guard.verifyFixtureOnly(state, key) ==
      SyntheticWitnessCheckLab.DENY_MISSING_WITNESS,
      "loss of detached receipt must fail closed without local fallback")
    Files.write(receipt, original)
    verify(guard.verifyFixtureOnly(state, key) ==
      SyntheticWitnessCheckLab.VERIFIED_FIXTURE_ONLY,
      "restoring detached receipt reestablishes valid proof")
    val detachedAlias = root().resolve("witness-target")
    Files.write(detachedAlias, original)
    Files.delete(receipt)
    Files.createSymbolicLink(receipt, detachedAlias)
    verify(guard.verifyFixtureOnly(state, key) ==
      SyntheticWitnessCheckLab.FAIL_CLOSED,
      "external receipt symlink fails closed without following redirected file")
  }
  // This explicit negative security finding is intentional: HMAC authenticates
  // each saved receipt but an attacker who restores BOTH old witness and old
  // snapshot can replay the old signed pair without possessing the MAC key.
  run {
    val s = scenario()
    val dir = root()
    val remote = root()
    val key = randomKey()
    seed(dir, s)
    val guard = witness(dir, remote)
    val old = witnessState(dir, s.before)
    guard.bootstrapFixtureOnly(old, key)
    val oldSignedWitness = Files.readAllBytes(remote.resolve("generation.witness"))
    prepare(dir, s)
    commit(dir, s)
    val fresh = witnessState(dir, s.after)
    verify(guard.advanceFixtureOnly(old, fresh, key) ==
      SyntheticWitnessCheckLab.ADVANCED_FIXTURE_ONLY,
      "test advances detached generation before replay attack")
    Files.write(remote.resolve("generation.witness"), oldSignedWitness)
    Files.write(dir.resolve("active.snapshot"), old.ciphertextFile)
    verify(guard.verifyFixtureOnly(witnessState(dir, s.before), key) ==
      SyntheticWitnessCheckLab.VERIFIED_FIXTURE_ONLY,
      "known limitation: replaying BOTH signed witness and old ciphertext remains possible")
    verify(guard.verifyFixtureOnly(fresh, key) ==
      SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT,
      "new generation is not verifiable after attacker replays entire witness store")
  }
  run {
    val s = scenario()
    val dir = root()
    seed(dir, s)
    val key = randomKey()
    val state = witnessState(dir, s.before)
    verify(witness(dir, dir.resolve("subdirectory")).bootstrapFixtureOnly(state, key) ==
      SyntheticWitnessCheckLab.FAIL_CLOSED,
      "external witness cannot be stored inside local journal directory")
    verify(witness(dir, dir).bootstrapFixtureOnly(state, key) ==
      SyntheticWitnessCheckLab.FAIL_CLOSED,
      "external witness directory cannot equal journal directory")
    verify(witness(dir, root()).bootstrapFixtureOnly(state, byteArrayOf(1, 2)) ==
      SyntheticWitnessCheckLab.DENY_AUTHENTICATION,
      "weak or short witness MAC key refused")
  }

  println("PASS: SEC-05K $checks durable-restart journal checks (disposable JVM fixtures)")
}
