package com.negresco.finance.security

import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * DEBUG-ONLY interactive QA. Does not exist in the Release variant.
 * Two genuine OS BIOMETRIC_STRONG prompts, one per AES/GCM operation.
 * Synthetic bytes ONLY. No SQLCipher, account, key export, JS bridge or
 * financial permission. Requires an explicitly opted-in physical QA session.
 */
class SyntheticBiometricManualQaActivity : FragmentActivity() {
  private var alias: String? = null
  private var key: SecretKey? = null
  private var prompt: BiometricPrompt? = null
  private var epoch = 0
  private var active = false
  private lateinit var label: TextView
  private lateinit var button: Button
  private var observer: ((String) -> Unit)? = null

  private fun store() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
  private fun aad() =
    ("negresco-debug-only|" + (alias ?: "absent")).toByteArray(Charsets.UTF_8)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(32, 48, 32, 32)
    }
    label = TextView(this).apply {
      textSize = 18f
      text = "DEBUG QA: duas confirmações biométricas, somente dados fictícios."
    }
    button = Button(this).apply {
      text = "Iniciar teste biométrico verdadeiro"
      setOnClickListener { startManualQa(null) }
    }
    layout.addView(label, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    layout.addView(button, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    setContentView(layout)
  }

  fun startManualQa(onDone: ((String) -> Unit)?) {
    if (active) return
    observer = onDone
    if (BiometricManager.from(this).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG) !=
      BiometricManager.BIOMETRIC_SUCCESS) {
      finishQa("HOLD_NOT_ENROLLED")
      return
    }
    try {
      clear()
      val name = "negresco_manual_fixture_${UUID.randomUUID()}"
      alias = name
      val generator = KeyGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
      generator.init(KeyGenParameterSpec.Builder(
        name, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .setUserAuthenticationRequired(true)
        .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        .setInvalidatedByBiometricEnrollment(true)
        .build())
      key = generator.generateKey()
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, key)
      cipher.updateAAD(aad())
      active = true
      button.isEnabled = false
      label.text = "1/2: confirme criptografia fictícia usando biometria forte."
      authenticate(cipher, "Criptografar bytes fictícios") { authorized ->
        val payload = "negresco-test-only".toByteArray(Charsets.UTF_8)
        val encrypted = try { authorized.doFinal(payload) }
          finally { payload.fill(0) }
        val nonce = authorized.iv.copyOf()
        // A fresh prompt must be started on the main thread after this one.
        button.post {
          if (active) startDecryption(nonce, encrypted)
          else {
            nonce.fill(0)
            encrypted.fill(0)
          }
        }
      }
    } catch (_: Exception) {
      finishQa("HOLD_SETUP_OR_CRYPTO_ERROR")
    }
  }

  private fun startDecryption(nonce: ByteArray, encrypted: ByteArray) {
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, requireNotNull(key), GCMParameterSpec(128, nonce))
      cipher.updateAAD(aad())
      label.text = "2/2: confirme descriptografia fictícia com nova biometria."
      authenticate(cipher, "Descriptografar bytes fictícios") { authorized ->
        val recovered = authorized.doFinal(encrypted)
        try {
          val expected = "negresco-test-only".toByteArray(Charsets.UTF_8)
          try {
            val matches = java.security.MessageDigest.isEqual(recovered, expected)
            finishQa(if (matches) "PASS_NATIVE_CRYPTO_ONLY" else "DENY_WRONG_PLAINTEXT")
          } finally { expected.fill(0) }
        } finally {
          recovered.fill(0)
          nonce.fill(0)
          encrypted.fill(0)
        }
      }
    } catch (_: Exception) {
      nonce.fill(0)
      encrypted.fill(0)
      finishQa("HOLD_SECOND_PROMPT_ERROR")
    }
  }

  private fun authenticate(cipher: Cipher, title: String, approved: (Cipher) -> Unit) {
    val attempt = ++epoch
    val info = BiometricPrompt.PromptInfo.Builder()
      .setTitle("Negresco QA: $title")
      .setSubtitle("Somente teste. Nenhuma transação financeira.")
      .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
      .setNegativeButtonText("Cancelar")
      .build()
    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationError(code: Int, errString: CharSequence) {
        if (active && attempt == epoch) finishQa("HOLD_CANCELLED_OR_ERROR")
      }
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        if (!active || attempt != epoch) return
        if (result.cryptoObject?.cipher !== cipher) {
          finishQa("DENY_DIFFERENT_CRYPTOOBJECT")
          return
        }
        try {
          // doFinal is checked by the real OS-backed per-use key.
          approved(cipher)
        } catch (_: Exception) {
          finishQa("HOLD_OS_CRYPTO_REJECTED")
        }
      }
    }
    prompt = BiometricPrompt(this, mainExecutor, callback)
    prompt?.authenticate(info, BiometricPrompt.CryptoObject(cipher))
  }

  private fun clear() {
    ++epoch
    active = false
    prompt?.cancelAuthentication()
    prompt = null
    key = null
    alias?.let { try { store().deleteEntry(it) } catch (_: Exception) { } }
    alias = null
    if (::button.isInitialized) button.isEnabled = true
  }

  private fun finishQa(status: String) {
    if (::label.isInitialized) label.text = "DEBUG QA: $status (sem permissão financeira)"
    clear()
    val callback = observer
    observer = null
    callback?.invoke(status)
  }

  override fun onStop() {
    if (active) finishQa("DENY_BACKGROUND_OR_STOP")
    super.onStop()
  }

  override fun onDestroy() {
    clear()
    observer = null
    super.onDestroy()
  }
}
