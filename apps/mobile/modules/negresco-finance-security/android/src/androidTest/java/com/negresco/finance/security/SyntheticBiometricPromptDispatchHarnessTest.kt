package com.negresco.finance.security

import androidx.biometric.BiometricManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import javax.crypto.spec.SecretKeySpec

/**
 * Unattended CI tests only negative and prompt-construction properties.
 *
 * NO OS biometric approval is injected or forged. The real
 * requestWithRealOperatingSystemPrompt(...) path is available only in the
 * instrumentation package for a separate physical-device interactive QA.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticBiometricPromptDispatchHarnessTest {
  @Test fun realPromptConfigurationExplicitlyPermitsStrongBiometricsOnly() {
    val harness = SyntheticBiometricPromptDispatchHarness()
    val info = harness.buildPrompt()
    assertEquals(BiometricManager.Authenticators.BIOMETRIC_STRONG,
      info.allowedAuthenticators)
    assertEquals("Cancelar", info.negativeButtonText)
    assertTrue(info.title.toString().contains("teste de autenticação nativa"))
    harness.destroy()
  }

  @Test fun SoftwareAesKeyCanNeverBecomeAcceptedBiometricKeystoreKey() {
    val harness = SyntheticBiometricPromptDispatchHarness()
    harness.foreground()
    val softwareKey = SecretKeySpec(ByteArray(32) { 42 }, "AES")
    assertFalse(harness.acceptsNativeStrongPerUseKeyForTestOnly(softwareKey))
    harness.revoke()
    assertFalse(harness.acceptsNativeStrongPerUseKeyForTestOnly(softwareKey))
    harness.destroy()
  }

  @Test fun DestroyedHarnessDoesNotReopenItsNativeEpoch() {
    val harness = SyntheticBiometricPromptDispatchHarness()
    harness.foreground()
    harness.revoke()
    harness.destroy()
    harness.foreground()
    // Still no identity or key approval: entrypoint has no financial API,
    // and tests never create synthetic approvals.
    assertFalse(harness.acceptsNativeStrongPerUseKeyForTestOnly(
      SecretKeySpec(ByteArray(32) { 7 }, "AES")))
  }
}
