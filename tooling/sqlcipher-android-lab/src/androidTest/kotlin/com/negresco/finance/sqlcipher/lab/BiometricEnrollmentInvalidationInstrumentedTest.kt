package com.negresco.finance.sqlcipher.lab

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * TWO-STAGE MANUAL emulator-only experiment.
 *
 * Setup requires an enrolled BIOMETRIC_STRONG authenticator and creates a
 * distinct, disposable Keystore alias. Then the human operator adds a NEW
 * fingerprint in Android Settings (outside this test). Verify must run in
 * the SAME emulator installation after that enrollment change.
 *
 * This experiment NEVER deletes/replaces aliases, fingerprints or files.
 * Never run on the owner's Samsung or a production finance installation.
 * Merely failing to use a key cannot prove which system event invalidated it:
 * the operator must separately attest the enrollment change.
 */
@RunWith(AndroidJUnit4::class)
class BiometricEnrollmentInvalidationInstrumentedTest {
  private val alias = "negresco_disposable_enrollment_probe_v1"
  private val markerName = "negresco_disposable_enrollment_probe_v1.marker"
  private val markerText = "NEGRESCO_LAB_ENROLLMENT_PROBE_V1"
  private val context get() = InstrumentationRegistry.getInstrumentation().targetContext

  private fun isEmulator(): Boolean =
    Build.FINGERPRINT.contains("generic", ignoreCase = true) ||
      Build.FINGERPRINT.contains("emulator", ignoreCase = true) ||
      Build.MODEL.contains("emulator", ignoreCase = true) ||
      Build.PRODUCT.contains("sdk", ignoreCase = true)

  private fun enabled(stage: String) {
    val arguments = InstrumentationRegistry.getArguments()
    assumeTrue("Explicit two-stage manual enrollment test required",
      arguments.getString("negrescoEnrollmentPhase") == stage)
    assumeTrue("Enrollment changes are NEVER run on a personal device", isEmulator())
    assumeTrue("API 30+ required for per-use strong biometric KeyStore keys",
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
  }

  private fun store(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  private fun marker(): File = File(context.noBackupFilesDir, markerName)

  @Test fun setupDisposableKeyBeforeChangingEnrolledFingerprint() {
    enabled("setup")
    assumeTrue("Enroll a strong fingerprint in the disposable emulator first",
      BiometricManager.from(context).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG
      ) == BiometricManager.BIOMETRIC_SUCCESS)

    // Protect any existing test evidence; a second setup must not reset it.
    assertFalse("Key already exists; use a NEW disposable emulator instead",
      store().containsAlias(alias))
    assertFalse("Marker already exists; use a NEW disposable emulator instead",
      marker().exists())

    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(KeyGenParameterSpec.Builder(
      alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    ).setKeySize(256)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(true)
      .setUserAuthenticationRequired(true)
      .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
      .setInvalidatedByBiometricEnrollment(true)
      .build())
    generator.generateKey()

    // A cipher can be initialized before authorization. This is NOT an unlock.
    val key = store().getKey(alias, null) as? SecretKey
      ?: throw AssertionError("Disposable KeyStore alias unavailable immediately after creation")
    Cipher.getInstance("AES/GCM/NoPadding").init(Cipher.ENCRYPT_MODE, key)

    assertTrue("The witness file must be created once, never overwritten",
      marker().createNewFile())
    marker().writeText(markerText, Charsets.US_ASCII)
    assertTrue("Lab-only alias was not persisted", store().containsAlias(alias))
  }

  @Test fun verifyKeyPermanentlyInvalidatedAfterOperatorEnrollsNewFingerprint() {
    enabled("verify")
    assertTrue("No setup witness exists: run setup in this emulator first", marker().isFile)
    assertTrue("Setup witness differs: do not infer biometric invalidation",
      marker().readText(Charsets.US_ASCII) == markerText)
    assertTrue("Alias was removed: missing does NOT prove biometric invalidation",
      store().containsAlias(alias))

    // Fail if encryption remains possible after the operator's NEW enrollment.
    // Only a precise permanent-invalidation signal is accepted as evidence;
    // generic I/O, key absence, permission or provider failure is NOT proof.
    val failure = runCatching {
      val key = store().getKey(alias, null) as? SecretKey
        ?: throw AssertionError("Existing alias has no accessible key")
      Cipher.getInstance("AES/GCM/NoPadding").init(Cipher.ENCRYPT_MODE, key)
    }.exceptionOrNull()
    var cursor: Throwable? = failure
    var invalidated = false
    while (cursor != null) {
      if (cursor is KeyPermanentlyInvalidatedException) {
        invalidated = true
        break
      }
      cursor = cursor.cause
    }
    assertTrue(
      "Expected permanent KeyStore invalidation; a generic failure or missing " +
        "key is not proof that biometric enrollment invalidated this key",
      invalidated
    )

    // Never delete the invalidated alias or data: a recovery design must be
    // tested independently before real financial records can use this policy.
    assertTrue(marker().readText(Charsets.US_ASCII) == markerText)
  }
}
