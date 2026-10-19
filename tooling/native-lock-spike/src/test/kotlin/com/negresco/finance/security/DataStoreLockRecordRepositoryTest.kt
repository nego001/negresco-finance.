package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.mutablePreferencesOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.Job
import java.io.File
import java.nio.file.Files

private class DataStoreHarness(private val file: File) {
  val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  val raw: DataStore<Preferences> = PreferenceDataStoreFactory.create(scope = scope) { file }
  val repository = DataStoreLockRecordRepository(raw)
  suspend fun close() {
    scope.coroutineContext[Job]!!.cancelAndJoin()
  }
}

private suspend fun seedSyntheticRecord(
  harness: DataStoreHarness,
  revision: Long = 3L,
  enabled: Boolean = true
) {
  harness.raw.updateData {
    mutablePreferencesOf(
      NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
      NativeLockDataStoreKeys.enabled to enabled,
      NativeLockDataStoreKeys.revision to revision
    )
  }
}

private suspend fun checkOne(testBody: suspend (File) -> Unit) {
  val dir = Files.createTempDirectory("negresco-datastore-spike-").toFile()
  try { testBody(File(dir, "native-lock.preferences_pb")) }
  finally { dir.deleteRecursively() }
}

internal suspend fun runDataStoreScenarios() {
  // No record must fail closed; there is no opt-out/default=false fallback.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      check(h.repository.read() == null)
      val result = runCatching { h.repository.enableIfCurrent(0L) }
      check(result.exceptionOrNull() is MissingNativeLockRecord)
    } finally { h.close() }
  }

  // An enable-only atomic transaction preserves revision checks.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      seedSyntheticRecord(h, enabled = false)
      check(h.repository.enableIfCurrent(3L) == LockRecord(1, true, 4L))
      check(h.repository.read() == LockRecord(1, true, 4L))
      val stale = runCatching { h.repository.enableIfCurrent(3L) }
      check(stale.exceptionOrNull() is StaleNativeLockRevision)
    } finally { h.close() }
  }

  // Closing and reopening the real DataStore file preserves the revision.
  checkOne { file ->
    val first = DataStoreHarness(file)
    try {
      seedSyntheticRecord(first, 11L, enabled = false)
      check(first.repository.enableIfCurrent(11L) == LockRecord(1, true, 12L))
    } finally { first.close() }
    val reopened = DataStoreHarness(file)
    try { check(reopened.repository.read() == LockRecord(1, true, 12L)) }
    finally { reopened.close() }
  }

  // Simultaneous callers must not both succeed with the same revision.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      seedSyntheticRecord(h, enabled = false)
      val outcomes = coroutineScope {
        val first = async { runCatching { h.repository.enableIfCurrent(3L) } }
        val second = async { runCatching { h.repository.enableIfCurrent(3L) } }
        listOf(first.await(), second.await())
      }
      check(outcomes.count { it.isSuccess } == 1)
      check(outcomes.count { it.exceptionOrNull() is StaleNativeLockRevision } == 1)
      check(h.repository.read() == LockRecord(1, true, 4L))
    } finally { h.close() }
  }

  // A partially populated record must be rejected, not silently completed.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      h.raw.updateData {
        mutablePreferencesOf(NativeLockDataStoreKeys.enabled to false)
      }
      check(runCatching { h.repository.read() }.exceptionOrNull() is InvalidNativeLockRecord)
    } finally { h.close() }
  }

  // Protocol versions other than V1 must be denied without altering the file.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      h.raw.updateData {
        mutablePreferencesOf(
          NativeLockDataStoreKeys.version to 999,
          NativeLockDataStoreKeys.enabled to false,
          NativeLockDataStoreKeys.revision to 0L
        )
      }
      check(runCatching { h.repository.read() }.exceptionOrNull() is InvalidNativeLockRecord)
      check(runCatching { h.repository.enableIfCurrent(0L) }.exceptionOrNull()
        is InvalidNativeLockRecord)
    } finally { h.close() }
  }

  // Corrupted physical bytes are never auto-replaced with a disabled record.
  checkOne { file ->
    file.writeBytes(byteArrayOf(0x4e, 0x46, 0x00, 0x7f, 0x01))
    val h = DataStoreHarness(file)
    try { check(runCatching { h.repository.read() }.isFailure) }
    finally { h.close() }
  }

  // 8. Legacy parser never treats corrupted data or pending opt-out as disabled.
  run {
    check(classifyLegacyLock("enabled", null) == LegacyLockMigrationDecision.PRESERVE_LOCK)
    check(classifyLegacyLock("disable-pending", null) == LegacyLockMigrationDecision.PRESERVE_LOCK)
    check(classifyLegacyLock("disabled", "pending") == LegacyLockMigrationDecision.PRESERVE_LOCK)
    check(classifyLegacyLock(null, "pending") == LegacyLockMigrationDecision.PRESERVE_LOCK)
    check(classifyLegacyLock(null, null) == LegacyLockMigrationDecision.NEEDS_EXPLICIT_SETUP)
    check(classifyLegacyLock("disabled", null) == LegacyLockMigrationDecision.NEEDS_EXPLICIT_SETUP)
    check(classifyLegacyLock("off", null) == LegacyLockMigrationDecision.REJECT_INVALID)
    check(classifyLegacyLock("enabled", "unexpected") == LegacyLockMigrationDecision.REJECT_INVALID)
  }

  // 9. Opted-in legacy marker seeds a locked native record and survives restart.
  checkOne { file ->
    val first = DataStoreHarness(file)
    try {
      check(first.repository.migrateLegacyLocked("enabled", null) == LockRecord(1, true, 0L))
    } finally { first.close() }
    val reopened = DataStoreHarness(file)
    try { check(reopened.repository.read() == LockRecord(1, true, 0L)) }
    finally { reopened.close() }
  }

  // 10. A surviving journal overrides 'disabled' and preserves the lock.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      check(h.repository.migrateLegacyLocked("disabled", "pending") == LockRecord(1, true, 0L))
      check(h.repository.read()!!.enabled)
    } finally { h.close() }
  }

  // 11. Legacy off/null requires explicit setup and never silently seeds native off.
  for (primary in listOf<String?>(null, "disabled")) {
    checkOne { file ->
      val h = DataStoreHarness(file)
      try {
        check(runCatching { h.repository.migrateLegacyLocked(primary, null) }
          .exceptionOrNull() is LegacyLockSetupRequired)
        check(h.repository.read() == null)
      } finally { h.close() }
    }
  }

  // 12. Invalid markers are rejected and cannot create a native record.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      check(runCatching { h.repository.migrateLegacyLocked("enabled", "corrupt") }
        .exceptionOrNull() is LegacyLockInvalid)
      check(runCatching { h.repository.migrateLegacyLocked("off", null) }
        .exceptionOrNull() is LegacyLockInvalid)
      check(h.repository.read() == null)
    } finally { h.close() }
  }

  // 13. Migration is idempotent and cannot overwrite a newer native decision.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      check(h.repository.migrateLegacyLocked("enabled", null) == LockRecord(1, true, 0L))
      // Simulate a pre-existing legacy off state without exposing a writer.
      seedSyntheticRecord(h, revision = 1L, enabled = false)
      check(h.repository.migrateLegacyLocked("enabled", "bad-journal") == LockRecord(1, false, 1L))
      check(h.repository.read() == LockRecord(1, false, 1L))
    } finally { h.close() }
  }

  // 14. Partial/corrupt native records cannot be repaired from legacy markers.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      h.raw.updateData { mutablePreferencesOf(NativeLockDataStoreKeys.enabled to false) }
      check(runCatching { h.repository.migrateLegacyLocked("enabled", null) }
        .exceptionOrNull() is InvalidNativeLockRecord)
    } finally { h.close() }
  }

  // 15. Racing migration callers serialize and only one native seed is committed.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      val outcomes = coroutineScope {
        val a = async { h.repository.migrateLegacyLocked("enabled", null) }
        val b = async { h.repository.migrateLegacyLocked("disabled", null) }
        listOf(runCatching { a.await() }, runCatching { b.await() })
      }
      check(outcomes.any { it.getOrNull() == LockRecord(1, true, 0L) })
      check(h.repository.read() == LockRecord(1, true, 0L))
    } finally { h.close() }
  }

  // 16. A prepared opt-out NEVER commits disabled, and blocks later state writes.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      seedSyntheticRecord(h)
      val prepared = h.repository.prepareDisable(3L)
      check(prepared == LockRecord(1, true, 4L, disablePending = true))
      check(h.repository.read() == prepared)
      check(runCatching { h.repository.enableIfCurrent(4L) }
        .exceptionOrNull() is PendingNativeLockDisable)
    } finally { h.close() }
  }

  // 17. A crash/reopen with pending opt-out ALWAYS retains the lock.
  checkOne { file ->
    val first = DataStoreHarness(file)
    try {
      seedSyntheticRecord(first, 11L)
      check(first.repository.prepareDisable(11L) ==
        LockRecord(1, true, 12L, disablePending = true))
    } finally { first.close() }
    val reopened = DataStoreHarness(file)
    try {
      check(reopened.repository.read() == LockRecord(1, true, 12L, disablePending = true))
      check(reopened.repository.recoverPreparedDisable() == LockRecord(1, true, 13L))
    } finally { reopened.close() }
    val again = DataStoreHarness(file)
    try { check(again.repository.read() == LockRecord(1, true, 13L)) }
    finally { again.close() }
  }

  // 18. Recovery is idempotent and does not rewrite a healthy record.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      seedSyntheticRecord(h)
      check(h.repository.recoverPreparedDisable() == LockRecord(1, true, 3L))
      check(h.repository.prepareDisable(3L).disablePending)
      check(h.repository.recoverPreparedDisable() == LockRecord(1, true, 5L))
      check(h.repository.recoverPreparedDisable() == LockRecord(1, true, 5L))
    } finally { h.close() }
  }

  // 19. Two racing preparations cannot create a second opt-out commit.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      seedSyntheticRecord(h)
      val outcome = coroutineScope {
        val a = async { runCatching { h.repository.prepareDisable(3L) } }
        val b = async { runCatching { h.repository.prepareDisable(3L) } }
        listOf(a.await(), b.await())
      }
      check(outcome.count { it.isSuccess } == 1)
      check(outcome.count { it.exceptionOrNull() is StaleNativeLockRevision } == 1)
      check(h.repository.read() == LockRecord(1, true, 4L, disablePending = true))
    } finally { h.close() }
  }

  // 20. A disabled record carrying pending=true is corrupt, not opted out.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      h.raw.updateData {
        mutablePreferencesOf(
          NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
          NativeLockDataStoreKeys.enabled to false,
          NativeLockDataStoreKeys.revision to 2L,
          NativeLockDataStoreKeys.disablePending to true
        )
      }
      check(runCatching { h.repository.read() }.exceptionOrNull() is InvalidNativeLockRecord)
      check(runCatching { h.repository.recoverPreparedDisable() }
        .exceptionOrNull() is InvalidNativeLockRecord)
    } finally { h.close() }
  }

  // 21. Legacy migration does not overwrite an existing pending native state.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      seedSyntheticRecord(h)
      val pending = h.repository.prepareDisable(3L)
      check(h.repository.migrateLegacyLocked("disabled", "bad-journal") == pending)
    } finally { h.close() }
  }

  // 22. Already disabled protection cannot stage a second opt-out.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      seedSyntheticRecord(h, revision = 4L, enabled = false)
      check(runCatching { h.repository.prepareDisable(4L) }
        .exceptionOrNull() is PendingNativeLockDisable)
      check(h.repository.read() == LockRecord(1, false, 4L))
    } finally { h.close() }
  }
  println("PASS: 22 real DataStore and legacy migration scenarios (isolated JVM only)")
}
