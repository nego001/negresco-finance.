package com.negresco.finance.security

import android.content.ComponentName
import android.content.pm.PackageManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Emulator-friendly negative checks. Never invokes a BiometricPrompt or
 * provides a YES_PHYSICAL_CONSENT runner argument.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticPhysicalBiometricQaGateTest {
  private fun sample(fingerprint: String = "samsung/QA/device:test",
    hardware: String = "exynos", product: String = "qa_phone",
    model: String = "QA Test Handset", brand: String = "samsung",
    manufacturer: String = "samsung") =
    SyntheticPhysicalBiometricQaGate.DeviceProfile(
      fingerprint, hardware, product, model, brand, manufacturer)

  @Test fun defaultUnattendedExecutionAlwaysDeniesEvenPlausibleHardware() {
    assertEquals(SyntheticPhysicalBiometricQaGate.Verdict.DENY_NO_EXPLICIT_OPT_IN,
      SyntheticPhysicalBiometricQaGate.classify(null, sample()))
    assertEquals(SyntheticPhysicalBiometricQaGate.Verdict.DENY_NO_EXPLICIT_OPT_IN,
      SyntheticPhysicalBiometricQaGate.classify("YES", sample()))
    assertEquals(SyntheticPhysicalBiometricQaGate.Verdict.DENY_NO_EXPLICIT_OPT_IN,
      SyntheticPhysicalBiometricQaGate.classify("yes_physical_consent", sample()))
  }

  @Test fun knownEmulatorsRemainDeniedEvenWithForgedExplicitOptIn() {
    val emulatorProfiles = listOf(
      sample(hardware = "ranchu"),
      sample(hardware = "goldfish"),
      sample(fingerprint = "generic/sdk_gphone64_x86_64"),
      sample(product = "sdk_gphone64_x86_64"),
      sample(model = "Android SDK built for x86"),
      sample(manufacturer = "Genymotion"),
      sample(hardware = "vbox86")
    )
    emulatorProfiles.forEach {
      assertEquals(SyntheticPhysicalBiometricQaGate.Verdict.DENY_KNOWN_EMULATOR,
        SyntheticPhysicalBiometricQaGate.classify("YES_PHYSICAL_CONSENT", it))
    }
  }

  @Test fun plausibleProfileNeverYieldsAStatementOfVerifiedPhysicalAttestation() {
    assertEquals(SyntheticPhysicalBiometricQaGate.Verdict.HUMAN_REVIEW_REQUIRED_NOT_ATTESTED,
      SyntheticPhysicalBiometricQaGate.classify("YES_PHYSICAL_CONSENT", sample()))
  }

  @Test fun debugQaScreenIsNotExportedToOtherAppsEvenInTestBuild() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val component = ComponentName(context, SyntheticBiometricManualQaActivity::class.java)
    val activity = context.packageManager.getActivityInfo(component, 0)
    assertEquals(component.className, activity.name)
    assertFalse("QA screen must not be exportable", activity.exported)
    assertTrue("QA Activity remains enabled only for explicit QA launch", activity.enabled)
  }
}
