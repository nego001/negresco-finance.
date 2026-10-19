package com.negresco.finance.security

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner

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
  private val coordinator = SuspendingNativeLockCoordinator(
    NativeLockAndroidStore.get(activity),
    SuspendedStrongBiometry { action -> prompt.authenticate(action) }
  )

  init {
    activity.lifecycle.addObserver(this)
  }

  override fun onResume(owner: LifecycleOwner) {
    coordinator.onForeground()
  }

  override fun onStop(owner: LifecycleOwner) {
    coordinator.onBackground()
  }

  override fun onDestroy(owner: LifecycleOwner) {
    coordinator.onBackground()
    owner.lifecycle.removeObserver(this)
  }

  fun lockNow() = coordinator.lockNow()
  suspend fun snapshot(): LockSnapshot = coordinator.snapshot()
  suspend fun unlock(): LockResult = coordinator.unlock()
  suspend fun enable(): LockResult = coordinator.enable()

  // Intentionally absent: no JS or native API can disable the lock via the lab.
  // Disable must be implemented only after the final transaction race is closed.
}
