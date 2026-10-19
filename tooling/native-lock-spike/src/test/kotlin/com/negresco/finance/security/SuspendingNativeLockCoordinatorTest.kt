package com.negresco.finance.security

import androidx.datastore.preferences.core.mutablePreferencesOf
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import java.io.File
import java.nio.file.Files
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import androidx.datastore.preferences.core.PreferenceDataStoreFactory

private suspend fun withCoordinatorStore(
  block: suspend (DataStoreLockRecordRepository) -> Unit
) {
  val dir = Files.createTempDirectory("negresco-native-coordinator-").toFile()
  val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  try {
    val raw = PreferenceDataStoreFactory.create(scope = scope) {
      File(dir, "session.preferences_pb")
    }
    raw.updateData {
      mutablePreferencesOf(
        NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
        NativeLockDataStoreKeys.enabled to true,
        NativeLockDataStoreKeys.revision to 3L
      )
    }
    block(DataStoreLockRecordRepository(raw))
  } finally {
    scope.coroutineContext[Job]!!.cancelAndJoin()
    dir.deleteRecursively()
  }
}

internal suspend fun runSuspendingCoordinatorScenarios() {
  // 1. Fresh instance starts sealed until Android onResume.
  withCoordinatorStore { repo ->
    val c = SuspendingNativeLockCoordinator(repo) { true }
    check(c.unlock() == LockResult.DENIED)
    check(!c.snapshot().unlocked)
  }
  // 2. Strong native response unlocks only for current foreground generation.
  withCoordinatorStore { repo ->
    val c = SuspendingNativeLockCoordinator(repo) { true }
    c.onForeground()
    check(c.unlock() == LockResult.SUCCESS)
    check(c.snapshot().unlocked)
    c.onBackground()
    check(!c.snapshot().unlocked)
    c.onForeground()
    check(!c.snapshot().unlocked)
  }
  // 3. Background + return DURING prompt invalidates the old response.
  withCoordinatorStore { repo ->
    lateinit var c: SuspendingNativeLockCoordinator
    c = SuspendingNativeLockCoordinator(repo) {
      c.onBackground()
      c.onForeground()
      true
    }
    c.onForeground()
    check(c.unlock() == LockResult.STALE)
    check(!c.snapshot().unlocked)
  }
  // 4. Cancelled/failed prompt grants no session.
  withCoordinatorStore { repo ->
    val c = SuspendingNativeLockCoordinator(repo) { false }
    c.onForeground()
    check(c.unlock() == LockResult.DENIED)
    check(!c.snapshot().unlocked)
  }
  // 5. Changed DataStore revision while prompt is visible invalidates unlock.
  withCoordinatorStore { repo ->
    val c = SuspendingNativeLockCoordinator(repo) {
      repo.compareAndSet(3L, true)
      true
    }
    c.onForeground()
    check(c.unlock() == LockResult.STALE)
    check(!c.snapshot().unlocked)
  }
  // 6. Native prompt requests serialize; one cannot overlap another.
  withCoordinatorStore { repo ->
    val gate = CompletableDeferred<Unit>()
    var active = 0
    var maxActive = 0
    val c = SuspendingNativeLockCoordinator(repo) {
      active++
      if (active > maxActive) maxActive = active
      gate.await()
      active--
      true
    }
    c.onForeground()
    coroutineScope {
      val one = async { c.unlock() }
      while (active == 0) delay(5)
      val two = async { c.unlock() }
      gate.complete(Unit)
      check(one.await() == LockResult.SUCCESS)
      check(two.await() == LockResult.SUCCESS)
    }
    check(maxActive == 1)
  }
  // 7. Native enable is an authenticated one-record atomic commit.
  withCoordinatorStore { repo ->
    repo.compareAndSet(3L, false)
    var lastAction: LockAction? = null
    val c = SuspendingNativeLockCoordinator(repo) { action ->
      lastAction = action
      true
    }
    c.onForeground()
    check(c.enable() == LockResult.SUCCESS)
    check(lastAction == LockAction.ENABLE)
    check(repo.read() == LockRecord(1, true, 5L))
  }
  // 8. onStop during enable prompt never commits a disabled->enabled write.
  withCoordinatorStore { repo ->
    repo.compareAndSet(3L, false)
    lateinit var c: SuspendingNativeLockCoordinator
    c = SuspendingNativeLockCoordinator(repo) {
      c.onBackground()
      true
    }
    c.onForeground()
    check(c.enable() == LockResult.STALE)
    check(repo.read() == LockRecord(1, false, 4L))
  }
  // 9. Opt-out cannot be invoked through the experimental coordinator.
  withCoordinatorStore { repo ->
    var promptCount = 0
    val c = SuspendingNativeLockCoordinator(repo) {
      promptCount++
      true
    }
    c.onForeground()
    check(c.disable() == LockResult.DENIED)
    check(promptCount == 0)
    check(repo.read() == LockRecord(1, true, 3L))
  }
  // 10. Invalid native data and absent record never unlock.
  withCoordinatorStore { repo ->
    repo.compareAndSet(3L, false)
    val c = SuspendingNativeLockCoordinator(repo) { true }
    c.onForeground()
    check(c.unlock() == LockResult.DENIED)
    check(!c.snapshot().unlocked)
  }
  // 11. Cancelling a suspended biometric prompt cannot grant access.
  withCoordinatorStore { repo ->
    val promptStarted = CompletableDeferred<Unit>()
    val waiting = CompletableDeferred<Boolean>()
    var blockPrompt = true
    val c = SuspendingNativeLockCoordinator(repo) {
      if (blockPrompt) {
        promptStarted.complete(Unit)
        waiting.await()
      } else true
    }
    c.onForeground()
    coroutineScope {
      val pending = async { c.unlock() }
      promptStarted.await()
      pending.cancelAndJoin()
      check(!c.snapshot().unlocked)
      blockPrompt = false
      check(c.unlock() == LockResult.SUCCESS)
    }
  }
  println("PASS: 11 suspending native lock coordinator scenarios (isolated JVM only)")
}
