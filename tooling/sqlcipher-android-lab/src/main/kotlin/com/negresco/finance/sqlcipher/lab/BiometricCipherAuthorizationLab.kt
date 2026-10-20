package com.negresco.finance.sqlcipher.lab

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
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
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import kotlin.coroutines.resume

/**
 * Synthetic lab only. No Expo bridge, persistent wallet, or financial keys.
 * A UI-only "authenticated=true" value is NOT accepted as cryptographic proof.
 */
internal object BiometricCipherAuthorizationLab {
  private const val ALIAS = "negresco_disposable_biometric_wrap_lab_v1"
  private const val PROVIDER = "AndroidKeyStore"
  internal class Unavailable : IllegalStateException("Biometric laboratory key unavailable")

  /** Provisioning is explicit; never provision in the decrypt/recovery path. */
  fun provisionForLabOnly(activity: FragmentActivity): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R ||
      BiometricManager.from(activity).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG
      ) != BiometricManager.BIOMETRIC_SUCCESS) throw Unavailable()

    try {
      val store = KeyStore.getInstance(PROVIDER).apply { load(null) }
      if (store.containsAlias(ALIAS)) return false
      val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER)
      generator.init(KeyGenParameterSpec.Builder(
        ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
      ).setKeySize(256)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .setUserAuthenticationRequired(true)
        .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        .setInvalidatedByBiometricEnrollment(true)
        .build())
      generator.generateKey()
      return true
    } catch (_: Exception) {
      throw Unavailable()
    }
  }

  fun existingKey(): SecretKey = try {
    KeyStore.getInstance(PROVIDER).apply { load(null) }
      .getKey(ALIAS, null) as? SecretKey ?: throw Unavailable()
  } catch (_: Exception) {
    throw Unavailable()
  }

  /**
   * Release only the SAME cipher returned by CryptoObject, after strong biometric
   * approval, while the activity remains RESUMED. Cancellation and onStop reject.
   * This is a one-operation laboratory primitive, not a durable login session.
   */
  suspend fun authorize(activity: FragmentActivity, cipher: Cipher): Cipher =
    withContext(Dispatchers.Main.immediate) {
      if (!activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) ||
        BiometricManager.from(activity).canAuthenticate(
          BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) != BiometricManager.BIOMETRIC_SUCCESS) throw Unavailable()

      val gate = BiometricOperationGate(cipher)
      val result = suspendCancellableCoroutine<Cipher?> { continuation ->
        var prompt: BiometricPrompt? = null
        var finished = false
        lateinit var observer: DefaultLifecycleObserver

        fun complete(candidate: Cipher?) {
          if (finished) return
          finished = true
          activity.lifecycle.removeObserver(observer)
          if (continuation.isActive) continuation.resume(candidate)
        }

        observer = object : DefaultLifecycleObserver {
          override fun onStop(owner: LifecycleOwner) {
            gate.revoke()
            prompt?.cancelAuthentication()
            complete(null)
          }
        }
        val callback = object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            val accepted = gate.approve(
              result.cryptoObject?.cipher,
              activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
            )
            complete(if (accepted) cipher else null)
          }
          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            gate.revoke()
            complete(null)
          }
          // A failed scan is not a successful authorization.
        }

        val info = BiometricPrompt.PromptInfo.Builder()
          .setTitle("Autorizar chave de teste")
          .setSubtitle("Somente laboratório Negresco Finance")
          .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
          .setNegativeButtonText("Cancelar")
          .setConfirmationRequired(true)
          .build()

        activity.lifecycle.addObserver(observer)
        continuation.invokeOnCancellation {
          gate.revoke()
          activity.runOnUiThread {
            activity.lifecycle.removeObserver(observer)
            prompt?.cancelAuthentication()
          }
        }
        try {
          prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback)
          prompt?.authenticate(info, BiometricPrompt.CryptoObject(cipher))
        } catch (_: RuntimeException) {
          gate.revoke()
          complete(null)
        }
      }
      if (result !== cipher || gate.consume(
          activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
        ) !== cipher) throw Unavailable()
      cipher
    }
}
