package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.mutablePreferencesOf
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.collect
import java.io.File
import java.nio.file.Files
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import androidx.datastore.preferences.core.PreferenceDataStoreFactory

private suspend fun withCoordinatorStore(
  block: suspend (DataStoreLockRecordRepository, DataStore<Preferences>) -> Unit
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
    block(DataStoreLockRecordRepository(raw), raw)
  } finally {
    scope.coroutineContext[Job]!!.cancelAndJoin()
    dir.deleteRecursively()
  }
}

internal suspend fun runSuspendingCoordinatorScenarios() {
  // 1. Fresh instance starts sealed until Android onResume.
  withCoordinatorStore { repo, _ ->
    val c = SuspendingNativeLockCoordinator(repo) { true }
    check(c.unlock() == LockResult.DENIED)
    check(!c.snapshot().unlocked)
  }
  // 2. Strong native response unlocks only for current foreground generation.
  withCoordinatorStore { repo, _ ->
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
  withCoordinatorStore { repo, _ ->
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
  withCoordinatorStore { repo, _ ->
    val c = SuspendingNativeLockCoordinator(repo) { false }
    c.onForeground()
    check(c.unlock() == LockResult.DENIED)
    check(!c.snapshot().unlocked)
  }
  // 5. Changed DataStore revision while prompt is visible invalidates unlock.
  withCoordinatorStore { repo, _ ->
    val c = SuspendingNativeLockCoordinator(repo) {
      repo.compareAndSet(3L, true)
      true
    }
    c.onForeground()
    check(c.unlock() == LockResult.STALE)
    check(!c.snapshot().unlocked)
  }
  // 6. Native prompt requests serialize; one cannot overlap another.
  withCoordinatorStore { repo, _ ->
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
  withCoordinatorStore { repo, _ ->
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
  withCoordinatorStore { repo, _ ->
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
  withCoordinatorStore { repo, _ ->
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
  withCoordinatorStore { repo, _ ->
    repo.compareAndSet(3L, false)
    val c = SuspendingNativeLockCoordinator(repo) { true }
    c.onForeground()
    check(c.unlock() == LockResult.DENIED)
    check(!c.snapshot().unlocked)
  }
  // 11. Cancelling a suspended biometric prompt cannot grant access.
  withCoordinatorStore { repo, _ ->
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
  // 12. A change in the persisted revision revokes an existing unlocked session.
  withCoordinatorStore { repo, _ ->
    val c = SuspendingNativeLockCoordinator(repo) { true }
    c.onForeground()
    check(c.unlock() == LockResult.SUCCESS)
    check(c.snapshot().unlocked)
    repo.compareAndSet(3L, true)
    check(!c.snapshot().unlocked)
    check(c.snapshot().revision == 4L)
    check(c.unlock() == LockResult.SUCCESS) // Only a fresh prompt reopens.
    check(c.snapshot().unlocked)
  }
  // 13. Disabling from another writer and re-enabling never restores old unlock.
  withCoordinatorStore { repo, _ ->
    var authentications = 0
    val c = SuspendingNativeLockCoordinator(repo) {
      authentications++
      true
    }
    c.onForeground()
    check(c.unlock() == LockResult.SUCCESS)
    repo.compareAndSet(3L, false)
    check(!c.snapshot().unlocked)
    check(!c.snapshot().enabled)
    repo.compareAndSet(4L, true)
    check(!c.snapshot().unlocked)
    check(c.unlock() == LockResult.SUCCESS)
    check(authentications == 2)
  }
  // 14. A corrupt record revokes the previously approved session permanently.
  withCoordinatorStore { repo, raw ->
    val c = SuspendingNativeLockCoordinator(repo) { true }
    c.onForeground()
    check(c.unlock() == LockResult.SUCCESS)
    raw.updateData {
      mutablePreferencesOf(NativeLockDataStoreKeys.enabled to false)
    }
    val damaged = c.snapshot()
    check(damaged.storageError && !damaged.unlocked)
    // Repairing disk does not restore the old in-memory biometric grant.
    raw.updateData {
      mutablePreferencesOf(
        NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
        NativeLockDataStoreKeys.enabled to true,
        NativeLockDataStoreKeys.revision to 3L
      )
    }
    check(!c.snapshot().unlocked)
    check(c.unlock() == LockResult.SUCCESS)
  }
  // 15. A missing record invalidates an old grant, even after later recovery.
  withCoordinatorStore { repo, raw ->
    val c = SuspendingNativeLockCoordinator(repo) { true }
    c.onForeground()
    check(c.unlock() == LockResult.SUCCESS)
    raw.updateData { mutablePreferencesOf() }
    check(c.snapshot().migrationRequired)
    check(!c.snapshot().unlocked)
    raw.updateData {
      mutablePreferencesOf(
        NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
        NativeLockDataStoreKeys.enabled to true,
        NativeLockDataStoreKeys.revision to 3L
      )
    }
    check(!c.snapshot().unlocked)
    check(c.unlock() == LockResult.SUCCESS)
  }
  // 16. Live persisted revision change revokes a grant WITHOUT a snapshot read.
  withCoordinatorStore { repo, _ ->
    val c = SuspendingNativeLockCoordinator(repo) { true }
    c.onForeground()
    coroutineScope {
      val signals = Channel<Boolean>(Channel.UNLIMITED)
      val watch = launch {
        repo.observe().collect { event ->
          signals.send(c.onPersistentStateChanged(event))
        }
      }
      try {
        check(!withTimeout(5000L) { signals.receive() }) // Initial record.
        check(c.unlock() == LockResult.SUCCESS)
        repo.compareAndSet(3L, true)
        check(withTimeout(5000L) { signals.receive() }) // Revision change revoked.
        check(!c.snapshot().unlocked)
        check(c.unlock() == LockResult.SUCCESS)
      } finally { watch.cancelAndJoin() }
    }
  }

  // 17. A malformed native record emits a fail-closed event and revokes.
  withCoordinatorStore { repo, raw ->
    val c = SuspendingNativeLockCoordinator(repo) { true }
    c.onForeground()
    coroutineScope {
      val signals = Channel<Pair<NativeLockObservation, Boolean>>(Channel.UNLIMITED)
      val watch = launch {
        repo.observe().collect { event ->
          signals.send(event to c.onPersistentStateChanged(event))
        }
      }
      try {
        check(withTimeout(5000L) { signals.receive() }.first is NativeLockObservation.Record)
        check(c.unlock() == LockResult.SUCCESS)
        raw.updateData { mutablePreferencesOf(NativeLockDataStoreKeys.enabled to false) }
        val (event, revoked) = withTimeout(5000L) { signals.receive() }
        check(event == NativeLockObservation.StorageError && revoked)
      } finally { watch.cancelAndJoin() }
    }
  }

  // 18. A deleted persisted record also revokes an existing grant immediately.
  withCoordinatorStore { repo, raw ->
    val c = SuspendingNativeLockCoordinator(repo) { true }
    c.onForeground()
    coroutineScope {
      val signals = Channel<Pair<NativeLockObservation, Boolean>>(Channel.UNLIMITED)
      val watch = launch {
        repo.observe().collect { event ->
          signals.send(event to c.onPersistentStateChanged(event))
        }
      }
      try {
        check(withTimeout(5000L) { signals.receive() }.first is NativeLockObservation.Record)
        check(c.unlock() == LockResult.SUCCESS)
        raw.updateData { mutablePreferencesOf() }
        val (event, revoked) = withTimeout(5000L) { signals.receive() }
        check(event == NativeLockObservation.Missing && revoked)
      } finally { watch.cancelAndJoin() }
    }
  }
  println("PASS: 18 suspending native lock coordinator scenarios (isolated JVM only)")
}
