package com.negresco.finance.security

/** Offline, dependency-free JVM checks. Not Android hardware QA. */
private class MemoryAtomicStore(initial: LockRecord? = LockRecord(1, true, 4L)) : AtomicLockStore {
  var record = initial
  var failRead = false
  var failWrite = false
  override fun read(): LockRecord? {
    if (failRead) error("unavailable")
    return record
  }
  override fun update(transform: (LockRecord?) -> LockRecord): LockRecord {
    if (failWrite) error("unavailable")
    val value = transform(record)
    record = value
    return value
  }
}

private fun assertResult(expected: LockResult, actual: LockResult) {
  check(expected == actual) { "expected $expected, actual $actual" }
}

fun main(args: Array<String>) {
  // SEC-05K child-process recovery entrypoint for an isolated JVM, NOT a service.
  // Only a temporary fixture directory crosses the process boundary. No DEK,
  // secret, plaintext or financial data is passed in command-line arguments.
  if (args.size == 2 && args[0] == "--sec05k-recover-fixture-only") {
    val state = SyntheticDurableRekeyJournalLab(
      java.nio.file.Paths.get(args[1])
    ).recoverFixtureOnly()
    println("SEC05K_CHILD_RESULT=" + state.check.name)
    return
  }
  // SEC-05K controlled hard-stop rehearsal: only disposable JVM fixtures.
  // The detached recovery secret travels through stdin, NEVER command-line
  // arguments or logs; the envelope is read from an independent test export.
  if (args.size == 5 && args[0] in setOf(
      "--sec05k-commit-halt-after-marker-fixture-only",
      "--sec05k-commit-halt-after-active-fixture-only"
    )) {
    val secret = ByteArray(32)
    val check = try {
      java.io.DataInputStream(System.`in`).readFully(secret)
      val crash = if (args[0] == "--sec05k-commit-halt-after-marker-fixture-only")
        SyntheticJournalCrashLab.AFTER_COMMIT_SYNC
      else SyntheticJournalCrashLab.AFTER_ACTIVE_REPLACE
      val backupBytes = java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(args[4]))
      SyntheticDurableRekeyJournalLab(
        java.nio.file.Paths.get(args[1])
      ).commitFixtureOnly(args[2], args[3], backupBytes, secret, crash).check
    } finally {
      // Scrub before either exitProcess or Runtime.halt.
      secret.fill(0)
    }
    if (check != SyntheticJournalCheckLab.SIMULATED_CRASH) {
      System.err.println("SEC05K_CHILD_DENIED=" + check.name)
      kotlin.system.exitProcess(4)
    }
    // No normal JVM teardown. Returns only after the injected filesystem
    // checkpoint has completed. Do NOT call outside disposable test fixtures.
    Runtime.getRuntime().halt(73)
  }
  // SEC-05K detached proof in a FRESH JVM without the original DEK in heap.
  // A verified envelope is loaded from a separate disposable export file;
  // a 32-byte test secret arrives on stdin and is wiped before returning.
  if (args.size == 7 && args[0] == "--sec05k-verify-detached-fixture-only") {
    val secret = ByteArray(32)
    val check = try {
      val received = System.`in`.readNBytes(secret, 0, secret.size)
      if (received != secret.size) {
        SyntheticJournalCheckLab.DENY_RECOVERY_PROOF
      } else {
        val backup = java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(args[6]))
        SyntheticDurableRekeyJournalLab(
          java.nio.file.Paths.get(args[1])
        ).verifyDetachedBackupAfterRestartFixtureOnly(
          args[2], args[3], args[4].toLong(), args[5].toLong(), backup, secret
        ).check
      }
    } finally { secret.fill(0) }
    println("SEC05K_DETACHED_PROOF=" + check.name)
    return
  }
  // Deliberately IGNORE the advisory migration.lock in a disposable fixture.
  // The test parent holds the lock; this child modifies only the candidate
  // of a randomly-named SEC-05K temp directory, never the active snapshot.
  if (args.size == 2 && args[0] == "--sec05k-noncooperative-candidate-fixture-only") {
    val dir = java.nio.file.Paths.get(args[1]).toAbsolutePath().normalize()
    require(dir.fileName.toString().startsWith("negresco-sec05k-disposable-"))
    require(java.nio.file.Files.isDirectory(dir, java.nio.file.LinkOption.NOFOLLOW_LINKS))
    require(!java.nio.file.Files.isSymbolicLink(dir))
    val target = dir.resolve("pending.snapshot")
    java.nio.channels.FileChannel.open(
      target, java.nio.file.StandardOpenOption.READ,
      java.nio.file.StandardOpenOption.WRITE, java.nio.file.LinkOption.NOFOLLOW_LINKS
    ).use { channel ->
      require(channel.size() in 37L..131072L)
      val first = java.nio.ByteBuffer.allocate(1)
      require(channel.read(first, 0L) == 1)
      val changed = java.nio.ByteBuffer.wrap(
        byteArrayOf((first.array()[0].toInt() xor 1).toByte())
      )
      require(channel.write(changed, 0L) == 1)
      channel.force(true)
    }
    println("SEC05K_NONCOOPERATIVE_CANDIDATE_MUTATED=FIXTURE_ONLY")
    return
  }
  require(args.isEmpty()) { "Unexpected arguments to isolated policy runner" }
  run {
    val storage = MemoryAtomicStore()
    val coordinator = NativeLockCoordinator(storage) { true }
    check(coordinator.snapshot().enabled && !coordinator.snapshot().unlocked)
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.UNLOCK))
    check(coordinator.snapshot().unlocked)
    coordinator.onBackground()
    check(!coordinator.snapshot().unlocked)
    assertResult(LockResult.DENIED, coordinator.request(LockAction.UNLOCK))
    coordinator.onForeground()
    check(!coordinator.snapshot().unlocked)
  }
  run {
    val storage = MemoryAtomicStore()
    lateinit var coordinator: NativeLockCoordinator
    coordinator = NativeLockCoordinator(storage) { coordinator.onBackground(); true }
    assertResult(LockResult.DENIED, coordinator.request(LockAction.DISABLE))
    check(storage.record!!.enabled)
  }
  run {
    val storage = MemoryAtomicStore()
    val coordinator = NativeLockCoordinator(storage) { false }
    assertResult(LockResult.DENIED, coordinator.request(LockAction.DISABLE))
    check(storage.record!!.enabled)
  }
  run {
    val storage = MemoryAtomicStore()
    var prompts = 0
    val coordinator = NativeLockCoordinator(storage) { prompts++; true }
    assertResult(LockResult.DENIED, coordinator.request(LockAction.DISABLE))
    check(storage.record == LockRecord(1, true, 4L))
    check(prompts == 0) // Denied BEFORE asking for biometrics.
    check(!coordinator.snapshot().unlocked)
  }
  run {
    val storage = MemoryAtomicStore()
    val coordinator = NativeLockCoordinator(storage) {
      storage.record = LockRecord(1, true, 5L)
      true
    }
    assertResult(LockResult.STALE, coordinator.request(LockAction.UNLOCK))
    check(storage.record!!.enabled)
  }
  run {
    val storage = MemoryAtomicStore(null)
    val coordinator = NativeLockCoordinator(storage) { true }
    check(coordinator.snapshot().migrationRequired)
    assertResult(LockResult.MIGRATION_REQUIRED, coordinator.request(LockAction.UNLOCK))
  }
  run {
    val storage = MemoryAtomicStore(LockRecord(7, false, 0L))
    val coordinator = NativeLockCoordinator(storage) { true }
    check(coordinator.snapshot().storageError && !coordinator.snapshot().unlocked)
    assertResult(LockResult.STORAGE_ERROR, coordinator.request(LockAction.ENABLE))
  }
  run {
    val storage = MemoryAtomicStore(LockRecord(1, false, 4L))
    storage.failWrite = true
    val coordinator = NativeLockCoordinator(storage) { true }
    assertResult(LockResult.STORAGE_ERROR, coordinator.request(LockAction.ENABLE))
    check(!storage.record!!.enabled)
  }
  run {
    val storage = MemoryAtomicStore()
    val coordinator = NativeLockCoordinator(storage) { true }
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.UNLOCK))
    coordinator.lockNow()
    check(!coordinator.snapshot().unlocked)
  }
  run {
    val storage = MemoryAtomicStore()
    lateinit var coordinator: NativeLockCoordinator
    coordinator = NativeLockCoordinator(storage) { action ->
      if (action == LockAction.UNLOCK) {
        assertResult(LockResult.DENIED, coordinator.request(LockAction.DISABLE))
      }
      true
    }
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.UNLOCK))
    check(storage.record!!.enabled)
  }
  // Legacy policy may enable a valid off record but NEVER disable one.
  run {
    val storage = MemoryAtomicStore(LockRecord(1, false, 4L))
    val coordinator = NativeLockCoordinator(storage) { true }
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.ENABLE))
    check(storage.record == LockRecord(1, true, 5L))
    check(coordinator.snapshot().unlocked)
    assertResult(LockResult.DENIED, coordinator.request(LockAction.DISABLE))
  }
  // Revision changed externally: an old biometric grant is not reusable.
  run {
    val storage = MemoryAtomicStore()
    val coordinator = NativeLockCoordinator(storage) { true }
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.UNLOCK))
    storage.record = LockRecord(1, true, 5L)
    check(!coordinator.snapshot().unlocked)
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.UNLOCK))
  }
  // A pending opt-out remains protected even if the old session was unlocked.
  run {
    val storage = MemoryAtomicStore()
    val coordinator = NativeLockCoordinator(storage) { true }
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.UNLOCK))
    storage.record = LockRecord(1, true, 5L, disablePending = true)
    check(!coordinator.snapshot().unlocked)
    assertResult(LockResult.DENIED, coordinator.request(LockAction.UNLOCK))
    assertResult(LockResult.DENIED, coordinator.request(LockAction.DISABLE))
  }
  // Contradictory native record is corruption, not an opt-out.
  run {
    val storage = MemoryAtomicStore(LockRecord(1, false, 4L, disablePending = true))
    val coordinator = NativeLockCoordinator(storage) { true }
    check(coordinator.snapshot().storageError)
    assertResult(LockResult.STORAGE_ERROR, coordinator.request(LockAction.UNLOCK))
    assertResult(LockResult.DENIED, coordinator.request(LockAction.DISABLE))
  }
  // Storage read failure must revoke a previously authenticated grant.
  run {
    val storage = MemoryAtomicStore()
    val coordinator = NativeLockCoordinator(storage) { true }
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.UNLOCK))
    storage.failRead = true
    check(coordinator.snapshot().storageError)
    storage.failRead = false
    check(!coordinator.snapshot().unlocked)
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.UNLOCK))
  }
  // Don't open an authentication prompt for an already enabled lock.
  run {
    val storage = MemoryAtomicStore()
    var prompts = 0
    val coordinator = NativeLockCoordinator(storage) { prompts++; true }
    assertResult(LockResult.DENIED, coordinator.request(LockAction.ENABLE))
    check(prompts == 0)
    check(storage.record == LockRecord(1, true, 4L))
  }
  println("PASS: 16 Kotlin native lock policy scenarios (offline JVM only)")
  kotlinx.coroutines.runBlocking {
    runDataStoreScenarios()
    runSuspendingCoordinatorScenarios()
    runOptOutInterleavingScenarios()
    runLockIntegrityScenarios()
    runFinancialEnvelopeScenarios()
    runSqlCipherLabGuardScenarios()
    runSecurityOperationPolicyScenarios()
    runSecurityAuditEventScenarios()
    runSyntheticDeviceTrustScenarios()
    runSignedDeviceProofScenarios()
    runSyntheticDeviceLedgerScenarios()
    runSignedAuthorityFloorScenarios()
    runSignedAuthorityLedgerIntegrationScenarios()
    runSyntheticDeviceEnrollmentProofScenarios()
    runPersistentEnrollmentInviteScenarios()
    runSyntheticAccountBoundInviteProofScenarios()
    runSyntheticAccountInviteAuthorityScenarios()
    runAllDevicesLostRecoveryScenarios()
    runSyntheticOfflineRecoveryKitScenarios()
    runSyntheticPortableRecoveryEnvelopeScenarios()
    runSyntheticRecoveryKitCeremonyScenarios()
    runSyntheticCompromisedKitRotationScenarios()
    runSyntheticDurableRekeyJournalScenarios()
    runSyntheticJournalAuthorityReconciliationPolicyScenarios()
    runSyntheticSignedRekeyAuthorityChallengeScenarios()
    runSyntheticDualDurableFloorAgreementScenarios()
    runSyntheticRekeyAuthorityCasTimeoutScenarios()
    runSyntheticProtectedAnchorBoundaryScenarios()
    runSyntheticAnchorLinearizationBoundaryScenarios()
    runSyntheticExternalAnchorAssuranceGateScenarios()
  }
}
