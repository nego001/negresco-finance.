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
    assertResult(LockResult.STALE, coordinator.request(LockAction.DISABLE))
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
    val coordinator = NativeLockCoordinator(storage) { true }
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.DISABLE))
    check(storage.record == LockRecord(1, false, 5L))
    check(!coordinator.snapshot().unlocked)
    assertResult(LockResult.STALE, coordinator.request(LockAction.UNLOCK))
  }
  run {
    val storage = MemoryAtomicStore()
    val coordinator = NativeLockCoordinator(storage) {
      storage.record = LockRecord(1, true, 5L)
      true
    }
    assertResult(LockResult.STORAGE_ERROR, coordinator.request(LockAction.DISABLE))
    check(storage.record!!.enabled)
  }
  run {
    val storage = MemoryAtomicStore(null)
    val coordinator = NativeLockCoordinator(storage) { true }
    check(coordinator.snapshot().migrationRequired)
    assertResult(LockResult.MIGRATION_REQUIRED, coordinator.request(LockAction.DISABLE))
  }
  run {
    val storage = MemoryAtomicStore(LockRecord(7, false, 0L))
    val coordinator = NativeLockCoordinator(storage) { true }
    check(coordinator.snapshot().storageError && !coordinator.snapshot().unlocked)
    assertResult(LockResult.STORAGE_ERROR, coordinator.request(LockAction.ENABLE))
  }
  run {
    val storage = MemoryAtomicStore()
    storage.failWrite = true
    val coordinator = NativeLockCoordinator(storage) { true }
    assertResult(LockResult.STORAGE_ERROR, coordinator.request(LockAction.DISABLE))
    check(storage.record!!.enabled)
  }
  run {
    val storage = MemoryAtomicStore()
    val coordinator = NativeLockCoordinator(storage) { true }
    assertResult(LockResult.SUCCESS, coordinator.request(LockAction.UNLOCK))
    coordinator.lockNow()
    check(!coordinator.snapshot().unlocked)
  }
  println("PASS: 9 Kotlin native lock policy scenarios (offline JVM only)")
}
