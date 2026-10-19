package com.negresco.finance.security

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

/**
 * Experimental Android strong-biometry-only prompt adapter.
 * This component is NOT an authentication transaction or an Expo module.
 * Its Boolean result MUST NEVER be exposed to JS or used alone to disable
 * an existing native lock. The eventual coordinator must revalidate the
 * lifecycle session immediately before the DataStore transaction.
 */
internal class StrongBiometricPrompt(private val activity: FragmentActivity) {
  suspend fun authenticate(action: LockAction): Boolean = withContext(Dispatchers.Main.immediate) {
    val level = BiometricManager.Authenticators.BIOMETRIC_STRONG
    if (!activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) ||
        BiometricManager.from(activity).canAuthenticate(level) != BiometricManager.BIOMETRIC_SUCCESS
    ) return@withContext false

    val heading = when (action) {
      LockAction.ENABLE -> "Ativar proteção biométrica"
      LockAction.DISABLE -> "Desativar proteção biométrica"
      LockAction.UNLOCK -> "Desbloquear Negresco Finance"
    }
    suspendCancellableCoroutine { continuation ->
      var prompt: BiometricPrompt? = null
      lateinit var observer: DefaultLifecycleObserver
      fun complete(accepted: Boolean) {
        activity.lifecycle.removeObserver(observer)
        if (continuation.isActive) continuation.resume(accepted)
      }

      observer = object : DefaultLifecycleObserver {
        override fun onStop(owner: LifecycleOwner) {
          prompt?.cancelAuthentication()
          complete(false)
        }
      }

      val callback = object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
          complete(activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
        }

        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
          complete(false)
        }

        // onAuthenticationFailed is not success or terminal cancellation.
        // The Android prompt may still accept another biometric attempt.
      }

      val info = BiometricPrompt.PromptInfo.Builder()
        .setTitle(heading)
        .setSubtitle("Negresco Finance · teste Android nativo")
        .setAllowedAuthenticators(level)
        .setConfirmationRequired(true)
        .setNegativeButtonText("Cancelar")
        .build()

      activity.lifecycle.addObserver(observer)
      continuation.invokeOnCancellation {
        activity.runOnUiThread {
          activity.lifecycle.removeObserver(observer)
          prompt?.cancelAuthentication()
        }
      }
      try {
        prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback)
        prompt?.authenticate(info)
      } catch (_: RuntimeException) {
        complete(false)
      }
    }
  }
}
