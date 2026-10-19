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

private suspend fun seedSyntheticRecord(harness: DataStoreHarness, revision: Long = 3L) {
  harness.raw.updateData {
    mutablePreferencesOf(
      NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
      NativeLockDataStoreKeys.enabled to true,
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
      val result = runCatching { h.repository.compareAndSet(0L, false) }
      check(result.exceptionOrNull() is MissingNativeLockRecord)
    } finally { h.close() }
  }

  // Full record updated as one transaction; a stale revision cannot disable it.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      seedSyntheticRecord(h)
      check(h.repository.compareAndSet(3L, false) == LockRecord(1, false, 4L))
      check(h.repository.read() == LockRecord(1, false, 4L))
      val stale = runCatching { h.repository.compareAndSet(3L, false) }
      check(stale.exceptionOrNull() is StaleNativeLockRevision)
    } finally { h.close() }
  }

  // Closing and reopening the real DataStore file preserves the revision.
  checkOne { file ->
    val first = DataStoreHarness(file)
    try {
      seedSyntheticRecord(first, 11L)
      check(first.repository.compareAndSet(11L, false) == LockRecord(1, false, 12L))
    } finally { first.close() }
    val reopened = DataStoreHarness(file)
    try { check(reopened.repository.read() == LockRecord(1, false, 12L)) }
    finally { reopened.close() }
  }

  // Simultaneous callers must not both succeed with the same revision.
  checkOne { file ->
    val h = DataStoreHarness(file)
    try {
      seedSyntheticRecord(h)
      val outcomes = coroutineScope {
        val first = async { runCatching { h.repository.compareAndSet(3L, false) } }
        val second = async { runCatching { h.repository.compareAndSet(3L, false) } }
        listOf(first.await(), second.await())
      }
      check(outcomes.count { it.isSuccess } == 1)
      check(outcomes.count { it.exceptionOrNull() is StaleNativeLockRevision } == 1)
      check(h.repository.read() == LockRecord(1, false, 4L))
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
      check(runCatching { h.repository.compareAndSet(0L, false) }.exceptionOrNull()
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

  println("PASS: 7 real DataStore persistence scenarios (isolated JVM only)")
}
