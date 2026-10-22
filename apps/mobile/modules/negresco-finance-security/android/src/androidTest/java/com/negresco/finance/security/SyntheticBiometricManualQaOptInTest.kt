package com.negresco.finance.security

import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * A real, two-prompt manual-only test. NEVER runs a biometric prompt in CI.
 *
 * To opt in, QA must execute on a PHYSICAL Android device with an enrolled
 * strong biometric and pass negresco.manual.biometric=YES_PHYSICAL_CONSENT.
 * No fake sensor event or AuthenticationResult. No banking data or permission.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticBiometricManualQaOptInTest {
  @Test fun realStrongBiometricRequiresExplicitPhysicalDeviceConsent() {
    val arguments = InstrumentationRegistry.getArguments()
    assumeTrue(
      "SKIP: real biometric QA is intentionally disabled for CI/emulators",
      arguments.getString("negresco.manual.biometric") == "YES_PHYSICAL_CONSENT"
    )
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val manager = context.getSystemService(android.content.Context.KEYGUARD_SERVICE)
      as android.app.KeyguardManager
    assumeTrue("SKIP: real QA requires a secure physical Android device",
      manager.isDeviceSecure)
    val result = AtomicReference("NO_CALLBACK")
    val completed = CountDownLatch(1)
    val scenario = ActivityScenario.launch(SyntheticBiometricManualQaActivity::class.java)
    try {
      scenario.onActivity { activity ->
        activity.startManualQa { outcome ->
          result.set(outcome)
          completed.countDown()
        }
      }
      assertTrue("two REAL biometric prompts need explicit human consent",
        completed.await(120, TimeUnit.SECONDS))
      assertEquals("PASS_NATIVE_CRYPTO_ONLY", result.get())
    } finally {
      scenario.close()
    }
  }
}
