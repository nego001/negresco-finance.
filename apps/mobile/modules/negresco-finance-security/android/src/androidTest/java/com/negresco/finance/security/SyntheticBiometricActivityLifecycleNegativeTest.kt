package com.negresco.finance.security

import android.widget.Button
import android.widget.TextView
import androidx.biometric.BiometricManager
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyStore
import java.util.concurrent.atomic.AtomicReference

/**
 * Runs in unattended CI. NEGATIVE UI lifecycle ONLY.
 *
 * Launching the debug QA Activity does not start a prompt, provision a
 * Keystore alias, or authorize ANY financial action. Strong-biometric
 * prompting is NEVER triggered on the emulator by these tests.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticBiometricActivityLifecycleNegativeTest {
  private fun ephemeralAliases(): Set<String> {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    return store.aliases().toList()
      .filter { it.startsWith("negresco_manual_fixture_") }.toSet()
  }

  @Test fun launchingAndBackgroundingQaActivityDoesNotCreateKeysOrConsent() {
    val before = ephemeralAliases()
    val scenario = ActivityScenario.launch(SyntheticBiometricManualQaActivity::class.java)
    try {
      scenario.onActivity { activity ->
        val root = activity.findViewById<android.view.ViewGroup>(android.R.id.content)
        val label = (root.getChildAt(0) as android.view.ViewGroup).getChildAt(0) as TextView
        val button = (root.getChildAt(0) as android.view.ViewGroup).getChildAt(1) as Button
        assertTrue("test-only screen identifies itself as DEBUG", label.text.contains("DEBUG QA"))
        assertTrue("manual QA requires user action", button.isEnabled)
      }
      assertEquals("Activity launch cannot create a native biometric key", before, ephemeralAliases())
      scenario.moveToState(Lifecycle.State.CREATED)
      assertEquals("background cannot enroll a key", before, ephemeralAliases())
      scenario.moveToState(Lifecycle.State.RESUMED)
      assertEquals("resuming cannot auto-authorize crypto", before, ephemeralAliases())
    } finally {
      scenario.close()
    }
    assertEquals("destroying unused QA screen leaves Keystore unchanged", before, ephemeralAliases())
  }

  @Test fun noStrongBiometricAlwaysHoldsWithoutCreatingAKeyOrPrompt() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    // If a device *has* enrolled strong biometric, do not start a prompt
    // during unattended CI; this particular negative test is inapplicable.
    assumeTrue("negative enrollment case only",
      BiometricManager.from(context).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG
      ) != BiometricManager.BIOMETRIC_SUCCESS)
    val before = ephemeralAliases()
    val result = AtomicReference("NONE")
    val scenario = ActivityScenario.launch(SyntheticBiometricManualQaActivity::class.java)
    try {
      scenario.onActivity { activity ->
        activity.startManualQa { outcome -> result.set(outcome) }
      }
      assertEquals("HOLD_NOT_ENROLLED", result.get())
      assertEquals("no biometric means no ephemeral encryption key", before, ephemeralAliases())
    } finally {
      scenario.close()
    }
    assertEquals(before, ephemeralAliases())
  }
}
