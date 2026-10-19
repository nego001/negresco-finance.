package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.mutablePreferencesOf
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Deterministic fault-injection model, NOT a hardware/Android DataStore proof.
 * Pauses on both sides of a commit to expose unsafe lifecycle interleavings.
 * The only permissible persisted outcome of preparation is enabled=true.
 */
private class GatedNativeLockStore(private val pauseAfterCommit: Boolean) : DataStore<Preferences> {
  private val mutex = Mutex()
  private val values = MutableStateFlow<Preferences>(
    mutablePreferencesOf(
      NativeLockDataStoreKeys.version to LOCK_RECORD_VERSION,
      NativeLockDataStoreKeys.enabled to true,
      NativeLockDataStoreKeys.revision to 3L
    )
  )

  val boundaryReached = CompletableDeferred<Unit>()
  val releaseBoundary = CompletableDeferred<Unit>()
  override val data: Flow<Preferences> get() = values

  override suspend fun updateData(transform: suspend (t: Preferences) -> Preferences): Preferences =
    mutex.withLock {
      val next = transform(values.value)
      if (!pauseAfterCommit) {
        boundaryReached.complete(Unit)
        releaseBoundary.await()
      }
      values.value = next
      if (pauseAfterCommit) {
        boundaryReached.complete(Unit)
        releaseBoundary.await()
      }
      next
    }
}

internal suspend fun runOptOutInterleavingScenarios() {
  // 1. onStop happens after biometric acceptance but BEFORE persistence.
  coroutineScope {
    val storage = GatedNativeLockStore(pauseAfterCommit = false)
    val repository = DataStoreLockRecordRepository(storage)
    val coordinator = SuspendingNativeLockCoordinator(repository) { true }
    coordinator.onForeground()
    val attempt = async { coordinator.prepareDisableForLab() }
    storage.boundaryReached.await()
    coordinator.onBackground()
    storage.releaseBoundary.complete(Unit)
    check(attempt.await() == LockResult.STALE)
    check(repository.read() == LockRecord(1, true, 4L, disablePending = true))
    check(repository.recoverPreparedDisable() == LockRecord(1, true, 5L))
  }

  // 2. onStop happens AFTER persistence but BEFORE updateData returns.
  coroutineScope {
    val storage = GatedNativeLockStore(pauseAfterCommit = true)
    val repository = DataStoreLockRecordRepository(storage)
    val coordinator = SuspendingNativeLockCoordinator(repository) { true }
    coordinator.onForeground()
    val attempt = async { coordinator.prepareDisableForLab() }
    storage.boundaryReached.await()
    coordinator.onBackground()
    storage.releaseBoundary.complete(Unit)
    check(attempt.await() == LockResult.STALE)
    check(repository.read() == LockRecord(1, true, 4L, disablePending = true))
    check(repository.recoverPreparedDisable() == LockRecord(1, true, 5L))
  }

  // 3. Cancel after the prepare marker was already committed: no opt-out.
  coroutineScope {
    val storage = GatedNativeLockStore(pauseAfterCommit = true)
    val repository = DataStoreLockRecordRepository(storage)
    val coordinator = SuspendingNativeLockCoordinator(repository) { true }
    coordinator.onForeground()
    val attempt = async { coordinator.prepareDisableForLab() }
    storage.boundaryReached.await()
    attempt.cancelAndJoin()
    storage.releaseBoundary.complete(Unit)
    check(repository.read() == LockRecord(1, true, 4L, disablePending = true))
    check(repository.recoverPreparedDisable() == LockRecord(1, true, 5L))
  }

  println("PASS: 3 deterministic opt-out interleaving scenarios (synthetic DataStore)")
}
