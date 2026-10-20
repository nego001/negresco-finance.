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

fun main() {
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
  }
}
