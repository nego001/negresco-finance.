package com.negresco.finance.sqlcipher.lab

import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.security.KeyStore
import java.util.concurrent.atomic.AtomicReference
import javax.crypto.Cipher
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Real Android lifecycle/biometric availability checks on a disposable Activity.
 * These tests DO NOT inject a fingerprint or assert successful biometric access.
 */
@RunWith(AndroidJUnit4::class)
class BiometricPlatformPreflightInstrumentedTest {
  private val alias = "negresco_disposable_biometric_wrap_lab_v1"

  private fun keyExists(): Boolean =
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.containsAlias(alias)

  @Test fun stoppedActivityCannotAuthorizeEvenBeforeShowingSystemPrompt() {
    ActivityScenario.launch(SyntheticBiometricTestActivity::class.java).use { scenario ->
      val activity = AtomicReference<SyntheticBiometricTestActivity>()
      scenario.onActivity { activity.set(it) }
      scenario.moveToState(Lifecycle.State.CREATED)

      val before = keyExists()
      val failure = runCatching {
        runBlocking {
          BiometricCipherAuthorizationLab.authorize(
            activity.get(), Cipher.getInstance("AES/GCM/NoPadding")
          )
        }
      }.exceptionOrNull()

      assertTrue("A stopped Activity must not reach an authenticated Cipher",
        failure is BiometricCipherAuthorizationLab.Unavailable)
      assertEquals("Rejected authorization must not mutate the Keystore", before, keyExists())
    }
  }

  @Test fun absentStrongBiometricsCannotProvisionDisposableKey() {
    ActivityScenario.launch(SyntheticBiometricTestActivity::class.java).use { scenario ->
      val activity = AtomicReference<SyntheticBiometricTestActivity>()
      scenario.onActivity { activity.set(it) }

      // This negative case is meaningful only if no BIOMETRIC_STRONG is enrolled.
      // It is not a substitute for a separate enrolled-sensor test.
      val ready = BiometricManager.from(activity.get()).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG
      ) == BiometricManager.BIOMETRIC_SUCCESS
      assumeTrue("Strong biometric already enrolled: no-enrollment check not applicable", !ready)

      val before = keyExists()
      val error = runCatching {
        BiometricCipherAuthorizationLab.provisionForLabOnly(activity.get())
      }.exceptionOrNull()
      assertTrue("Provisioning without strong biometric must fail closed",
        error is BiometricCipherAuthorizationLab.Unavailable)
      assertEquals("Failed provisioning must not replace or delete an existing key",
        before, keyExists())
    }
  }
}
