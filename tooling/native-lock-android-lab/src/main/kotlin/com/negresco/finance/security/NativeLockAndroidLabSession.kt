package com.negresco.finance.security

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

/**
 * Isolated Android host adapter for the coroutine-native lock coordinator.
 * NOT an Expo module; no JS bridge, no stored secrets or live app integration.
 *
 * The Android Activity must own this object's lifetime, not an app-wide JS
 * singleton. Lifecycle callbacks revoke the in-memory session synchronously.
 */
internal class NativeLockAndroidLabSession(
  private val activity: FragmentActivity
) : DefaultLifecycleObserver {
  private val prompt = StrongBiometricPrompt(activity)
  private val observationScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private val coordinator = SuspendingNativeLockCoordinator(
    NativeLockAndroidStore.get(activity),
    SuspendedStrongBiometry { action -> prompt.authenticate(action) },
    requireLiveObservation = true
  )

  init {
    activity.lifecycle.addObserver(this)
    observationScope.launch {
      try {
        // Observe the SAME process-scoped DataStore instance used for writes.
        // No event here can grant access, only revoke a stale UI session.
        NativeLockAndroidStore.get(activity).observe().collect { event ->
          coordinator.onPersistentStateChanged(event)
        }
        // Even a clean (unexpected) stream completion means monitoring ended.
        coordinator.onPersistentStateChanged(NativeLockObservation.StorageError)
      } catch (cancelled: CancellationException) {
        throw cancelled
      } catch (_: Exception) {
        // If observation fails, revoke; recovery requires a new Activity.
        coordinator.onPersistentStateChanged(NativeLockObservation.StorageError)
      }
    }
  }

  override fun onResume(owner: LifecycleOwner) {
    coordinator.onForeground()
  }

  override fun onStop(owner: LifecycleOwner) {
    coordinator.onBackground()
  }

  override fun onDestroy(owner: LifecycleOwner) {
    coordinator.onBackground()
    observationScope.cancel()
    owner.lifecycle.removeObserver(this)
  }

  fun lockNow() = coordinator.lockNow()
  suspend fun snapshot(): LockSnapshot = coordinator.snapshot()
  suspend fun unlock(): LockResult = coordinator.unlock()
  suspend fun enable(): LockResult = coordinator.enable()

  // Intentionally absent: no JS or native API can disable the lock via the lab.
  // Disable must be implemented only after the final transaction race is closed.
}
