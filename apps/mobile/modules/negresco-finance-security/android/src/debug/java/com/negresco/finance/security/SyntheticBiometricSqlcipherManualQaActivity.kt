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
import net.zetetic.database.sqlcipher.SQLiteDatabase
import java.io.File
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * DEBUG ONLY, non-exported, human-operated native integration rehearsal.
 * Two real CryptoObject prompts seal and unseal a disposable SQLCipher key.
 * No user funds, persistent database, JS authorization or Release code.
 */
class SyntheticBiometricSqlcipherManualQaActivity : FragmentActivity() {
  private var epoch = 0
  private var active = false
  private var consumed = true
  private var key: SecretKey? = null
  private var alias: String? = null
  private var root: File? = null
  private var encrypted: ByteArray? = null
  private var nonce: ByteArray? = null
  private var prompt: BiometricPrompt? = null
  private var observer: ((String) -> Unit)? = null
  private lateinit var label: TextView
  private lateinit var button: Button

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(32, 48, 32, 32)
    }
    label = TextView(this).apply {
      text = "DEBUG QA: duas biometrias, somente banco fictício"
      textSize = 18f
    }
    button = Button(this).apply {
      text = "Iniciar teste nativo (sem dados financeiros)"
      setOnClickListener { startManualQa(null) }
    }
    layout.addView(label, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    layout.addView(button, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    setContentView(layout)
  }

  private fun store() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
  private fun aad() = ("DEBUG_SQLCIPHER|" + (alias ?: "invalid"))
    .toByteArray(Charsets.UTF_8)

  fun startManualQa(done: ((String) -> Unit)?) {
    if (active) return
    observer = done
    if (BiometricManager.from(this).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG) !=
        BiometricManager.BIOMETRIC_SUCCESS) {
      finishQa("HOLD_NO_STRONG_BIOMETRIC")
      return
    }
    try {
      cleanup()
      System.loadLibrary("sqlcipher")
      val temp = File(cacheDir, "negresco_qa_sqlcipher_" + UUID.randomUUID())
      check(temp.mkdirs()) { "isolated QA folder unavailable" }
      root = temp
      val name = "negresco_debug_sqlcipher_" + UUID.randomUUID()
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
        .setInvalidatedByBiometricEnrollment(true).build())
      key = generator.generateKey()
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, requireNotNull(key))
      cipher.updateAAD(aad())
      active = true
      button.isEnabled = false
      request(cipher, 1)
    } catch (_: Exception) { finishQa("HOLD_SETUP_ERROR") }
  }

  private fun request(cipher: Cipher, stage: Int) {
    val requestEpoch = ++epoch
    consumed = false
    val info = BiometricPrompt.PromptInfo.Builder()
      .setTitle(if (stage == 1) "DEBUG: proteger chave fictícia"
        else "DEBUG: abrir banco fictício")
      .setSubtitle("Exige uma confirmação biométrica real por operação")
      .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
      .setNegativeButtonText("Cancelar")
      .build()
    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationError(code: Int, errString: CharSequence) {
        if (active && epoch == requestEpoch && !consumed) {
          consumed = true
          finishQa("HOLD_CANCELLED")
        }
      }
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        if (!active || epoch != requestEpoch || consumed) return
        consumed = true
        if (result.cryptoObject?.cipher !== cipher) {
          finishQa("DENY_CRYPTOOBJECT_MISMATCH")
          return
        }
        try {
          if (stage == 1) firstApproved(cipher) else secondApproved(cipher)
        } catch (_: Exception) { finishQa("HOLD_CRYPTO_OR_DATABASE_ERROR") }
      }
    }
    prompt = BiometricPrompt(this, mainExecutor, callback)
    prompt?.authenticate(info, BiometricPrompt.CryptoObject(cipher))
  }

  private fun firstApproved(cipher: Cipher) {
    val password = (UUID.randomUUID().toString() + UUID.randomUUID())
      .toByteArray(Charsets.UTF_8)
    try {
      // A callback alone is not permission: AndroidKeyStore must doFinal.
      val ciphertext = cipher.doFinal(password)
      val iv = cipher.iv.copyOf()
      val file = File(requireNotNull(root), "synthetic.db")
      val database = SQLiteDatabase.openOrCreateDatabase(
        file, password.toString(Charsets.UTF_8), null, null, null)
      try {
        database.execSQL("CREATE TABLE fixture(text TEXT NOT NULL)")
        database.execSQL("INSERT INTO fixture(text) VALUES (?)",
          arrayOf("test-not-money"))
      } finally { database.close() }
      encrypted = ciphertext
      nonce = iv
    } finally {
      password.fill(0) // SQLCipher JVM String copy cannot be guaranteed erased.
    }
    button.post {
      if (!active) return@post
      try {
        val cipherTwo = Cipher.getInstance("AES/GCM/NoPadding")
        cipherTwo.init(Cipher.DECRYPT_MODE, requireNotNull(key),
          GCMParameterSpec(128, requireNotNull(nonce)))
        cipherTwo.updateAAD(aad())
        request(cipherTwo, 2)
      } catch (_: Exception) { finishQa("HOLD_SECOND_PROMPT_ERROR") }
    }
  }

  private fun secondApproved(cipher: Cipher) {
    val secret = cipher.doFinal(requireNotNull(encrypted))
    try {
      val file = File(requireNotNull(root), "synthetic.db")
      if (!file.isFile) {
        finishQa("HOLD_MISSING_DATABASE")
        return
      }
      // Never openOrCreate here: missing/wrong-key databases remain blocked.
      val db = SQLiteDatabase.openDatabase(file.absolutePath,
        secret.toString(Charsets.UTF_8), null,
        SQLiteDatabase.OPEN_READONLY, null, null)
      val valid = try {
        db.rawQuery("SELECT text FROM fixture", null).use { cursor ->
          cursor.moveToFirst() && cursor.getString(0) == "test-not-money"
        }
      } finally { db.close() }
      finishQa(if (valid) "PASS_DEBUG_BIOMETRIC_SQLCIPHER_ONLY"
        else "DENY_SYNTHETIC_MISMATCH")
    } finally { secret.fill(0) }
  }

  private fun cleanup() {
    ++epoch
    active = false
    consumed = true
    prompt?.cancelAuthentication()
    prompt = null
    encrypted?.fill(0)
    nonce?.fill(0)
    encrypted = null
    nonce = null
    key = null
    alias?.let { try { store().deleteEntry(it) } catch (_: Exception) {} }
    alias = null
    root?.let {
      try { SQLiteDatabase.deleteDatabase(File(it, "synthetic.db")) }
      catch (_: Exception) {}
      it.deleteRecursively()
    }
    root = null
    if (::button.isInitialized) button.isEnabled = true
  }

  private fun finishQa(outcome: String) {
    if (::label.isInitialized) label.text = "DEBUG QA: " + outcome
    cleanup()
    val callback = observer
    observer = null
    callback?.invoke(outcome)
  }

  override fun onStop() {
    if (active) finishQa("DENY_BACKGROUND")
    super.onStop()
  }

  override fun onDestroy() {
    cleanup()
    observer = null
    super.onDestroy()
  }
}
