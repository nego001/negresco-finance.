package com.negresco.finance.security

import android.app.KeyguardManager
import android.content.Context
import androidx.biometric.BiometricManager
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

/** Explicit human-in-the-loop physical QA, NEVER auto-approved in CI. */
@RunWith(AndroidJUnit4::class)
class SyntheticBiometricSqlcipherManualQaOptInTest {
  @Test fun realBiometricTwiceThenSyntheticSqlcipherReopensWithNoJsAccess() {
    val args = InstrumentationRegistry.getArguments()
    val verdict = SyntheticPhysicalBiometricQaGate.classify(
      args.getString("negresco.manual.biometric.sqlcipher"),
      SyntheticPhysicalBiometricQaGate.currentDevice())
    assumeTrue("physical device and explicit opt-in required: " + verdict,
      verdict == SyntheticPhysicalBiometricQaGate.Verdict.HUMAN_REVIEW_REQUIRED_NOT_ATTESTED)
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val manager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    assumeTrue("secure screen lock required", manager.isDeviceSecure)
    assumeTrue("strong fingerprint required",
      BiometricManager.from(context).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
          BiometricManager.BIOMETRIC_SUCCESS)
    val result = AtomicReference("NO_CALLBACK")
    val done = CountDownLatch(1)
    val scenario = ActivityScenario.launch(SyntheticBiometricSqlcipherManualQaActivity::class.java)
    try {
      scenario.onActivity { activity ->
        activity.startManualQa { code -> result.set(code); done.countDown() }
      }
      assertTrue("two real biometric prompts must be completed by a human",
        done.await(120, TimeUnit.SECONDS))
      assertEquals("PASS_DEBUG_BIOMETRIC_SQLCIPHER_ONLY", result.get())
    } finally { scenario.close() }
  }
}
