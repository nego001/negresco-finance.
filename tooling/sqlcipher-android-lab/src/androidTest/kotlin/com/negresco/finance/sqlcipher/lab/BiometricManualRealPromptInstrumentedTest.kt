package com.negresco.finance.sqlcipher.lab

import androidx.biometric.BiometricManager
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.security.SecureRandom
import javax.crypto.Cipher
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Opt-in ONLY: real system BiometricPrompt and AndroidKeyStore, with a
 * disposable 32-byte synthetic secret. Requires a strong biometric enrollment,
 * a foreground Android test Activity and two user/simulator authentications.
 *
 * Deliberately SKIPPED in the default unattended CI. Passing normal CI
 * proves NOTHING about real sensor behavior. No app/financial records involved.
 */
@RunWith(AndroidJUnit4::class)
class BiometricManualRealPromptInstrumentedTest {
  @Test fun directKeystoreOperationWithoutBiometricMustFail() {
    val options = InstrumentationRegistry.getArguments()
    assumeTrue("Explicit biometrics-only test flag is required",
      options.getString("negrescoBiometricManual") == "true")

    ActivityScenario.launch(SyntheticBiometricTestActivity::class.java).use { scenario ->
      val activity = AtomicReference<SyntheticBiometricTestActivity>()
      scenario.onActivity { activity.set(it) }
      assertTrue("Enrolled strong biometrics are required",
        BiometricManager.from(activity.get()).canAuthenticate(
          BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) == BiometricManager.BIOMETRIC_SUCCESS)

      BiometricCipherAuthorizationLab.provisionForLabOnly(activity.get())

      // Do not show a prompt. Per-use KeyStore authorization MUST prevent an
      // otherwise correctly initialized Cipher from executing AES-GCM.
      val attempt = runCatching {
        val raw = Cipher.getInstance("AES/GCM/NoPadding")
        raw.init(Cipher.ENCRYPT_MODE, BiometricCipherAuthorizationLab.existingKey())
        raw.doFinal(ByteArray(32))
      }
      assertTrue("A non-prompt Cipher must not use the authenticated key",
        attempt.isFailure)
    }
  }

  @Test fun backgroundingAnActiveSystemPromptMustDenyAuthorization() {
    val options = InstrumentationRegistry.getArguments()
    assumeTrue("Explicit manual prompt test opt-in required",
      options.getString("negrescoBiometricManual") == "true")

    ActivityScenario.launch(SyntheticBiometricTestActivity::class.java).use { scenario ->
      val activity = AtomicReference<SyntheticBiometricTestActivity>()
      scenario.onActivity { activity.set(it) }
      assertTrue("Enrolled strong biometrics are required",
        BiometricManager.from(activity.get()).canAuthenticate(
          BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) == BiometricManager.BIOMETRIC_SUCCESS)

      // Must provision and initialize a REAL Keystore Cipher. Passing an
      // uninitialized Cipher could fail before a prompt ever starts, giving
      // misleading "success" to a lifecycle cancellation test.
      BiometricCipherAuthorizationLab.provisionForLabOnly(activity.get())
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, BiometricCipherAuthorizationLab.existingKey())

      val result = runBlocking {
        withTimeout(10_000) {
          val pending = async(Dispatchers.Default) {
            runCatching {
              BiometricCipherAuthorizationLab.authorize(activity.get(), cipher)
            }.exceptionOrNull()
          }
          // No fingerprint is supplied. A promptly rejected operation must
          // FAIL the test rather than masquerade as onStop cancellation.
          delay(650)
          assertFalse("The biometric prompt returned before Activity suspension",
            pending.isCompleted)
          scenario.moveToState(Lifecycle.State.CREATED)
          pending.await()
        }
      }
      assertTrue("Backgrounding during a real prompt must fail closed",
        result is BiometricCipherAuthorizationLab.Unavailable)
    }
  }

  @Test fun manuallyAuthorizeTwoOperationsToReopenSyntheticEnvelope() {
    val options = InstrumentationRegistry.getArguments()
    assumeTrue("Manual biometric prompt test is opt-in only",
      options.getString("negrescoBiometricManual") == "true")

    ActivityScenario.launch(SyntheticBiometricTestActivity::class.java).use { scenario ->
      val activity = AtomicReference<SyntheticBiometricTestActivity>()
      scenario.onActivity { activity.set(it) }

      assertTrue("Requires a device with enrolled BIOMETRIC_STRONG",
        BiometricManager.from(activity.get()).canAuthenticate(
          BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) == BiometricManager.BIOMETRIC_SUCCESS)

      // The KeyStore alias is a disposable lab-only key, never a finance key.
      // Existing keys are NOT deleted or recreated, even on failure.
      BiometricCipherAuthorizationLab.provisionForLabOnly(activity.get())
      val testPassphrase = ByteArray(32).also { SecureRandom().nextBytes(it) }
      try {
        runBlocking {
          // This timeout is a safety gate for unattended/failed manual runs.
          // A biometric prompt MUST be approved twice, once per operation.
          withTimeout(120_000) {
            val envelope = BiometricSqlCipherKeyEnvelopeLab.wrapForLabOnly(
              activity.get(), testPassphrase
            )
            val result = BiometricSqlCipherKeyEnvelopeLab.unwrapForLabOnly(
              activity.get(), envelope
            )
            try {
              assertArrayEquals(testPassphrase, result)
            } finally {
              result.fill(0)
            }
          }
        }
      } finally {
        testPassphrase.fill(0)
      }
    }
  }
}
