package com.negresco.finance.sqlcipher.lab

import android.security.keystore.KeyPermanentlyInvalidatedException
import java.security.KeyStore
import java.security.UnrecoverableKeyException
import javax.crypto.Cipher
import javax.crypto.SecretKey

/**
 * Read-only check of the dedicated DISPOSABLE biometric key.
 *
 * A missing alias is not proof of changed fingerprints (an app reinstall,
 * profile removal, storage fault, etc. can produce the same observation).
 * AUTHENTICATION_REQUIRED means a cipher INITIALIZED; it does NOT mean the
 * AES operation can execute without a new BiometricPrompt.CryptoObject.
 *
 * No key creation, deletion, disk writes, recovery or app integration.
 */
internal object BiometricKeyHealthLab {
  private const val PROVIDER = "AndroidKeyStore"
  private const val ALIAS = "negresco_disposable_biometric_wrap_lab_v1"

  internal enum class State {
    MISSING,
    AUTHENTICATION_REQUIRED,
    INVALIDATED_OR_UNRECOVERABLE,
    UNAVAILABLE
  }

  fun inspect(): State = try {
    val store = KeyStore.getInstance(PROVIDER).apply { load(null) }
    if (!store.containsAlias(ALIAS)) {
      State.MISSING
    } else {
      val key = store.getKey(ALIAS, null) as? SecretKey
      if (key == null) State.INVALIDATED_OR_UNRECOVERABLE
      else {
        // Cipher.init does NOT perform an authenticated key operation.
        // It can expose permanent invalidation before prompting, without
        // ever calling doFinal() or returning a plaintext secret.
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        State.AUTHENTICATION_REQUIRED
      }
    }
  } catch (_: KeyPermanentlyInvalidatedException) {
    State.INVALIDATED_OR_UNRECOVERABLE
  } catch (_: UnrecoverableKeyException) {
    State.INVALIDATED_OR_UNRECOVERABLE
  } catch (_: Exception) {
    // Device/Keystore errors must NOT be treated as missing or recovered.
    State.UNAVAILABLE
  }
}

/**
 * Minimal, fail-closed UI decision contract. Not a recovery implementation.
 *
 * In particular, there is no "generate a new key and continue" branch:
 * that would strand the original encrypted database behind an unknown key.
 */
internal object BiometricRecoveryGateLab {
  internal enum class Action {
    ASK_FOR_BIOMETRIC,
    KEEP_ENCRYPTED_AND_REQUIRE_INDEPENDENT_RECOVERY,
    KEEP_LOCKED_AND_RETRY_LATER
  }

  fun decide(state: BiometricKeyHealthLab.State): Action = when (state) {
    BiometricKeyHealthLab.State.AUTHENTICATION_REQUIRED -> Action.ASK_FOR_BIOMETRIC
    BiometricKeyHealthLab.State.MISSING,
    BiometricKeyHealthLab.State.INVALIDATED_OR_UNRECOVERABLE ->
      Action.KEEP_ENCRYPTED_AND_REQUIRE_INDEPENDENT_RECOVERY
    BiometricKeyHealthLab.State.UNAVAILABLE -> Action.KEEP_LOCKED_AND_RETRY_LATER
  }
}
