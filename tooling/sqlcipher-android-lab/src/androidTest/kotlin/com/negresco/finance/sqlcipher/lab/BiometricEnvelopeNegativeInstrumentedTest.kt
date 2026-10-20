package com.negresco.finance.sqlcipher.lab

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyStore

/** Negative-format tests: no biometric prompt, real financial key or selfie. */
@RunWith(AndroidJUnit4::class)
class BiometricEnvelopeNegativeInstrumentedTest {
  private fun structuralFixture(): ByteArray =
    byteArrayOf(0x4e, 0x42, 0x4b, 0x57, 0x01) + ByteArray(12 + 32 + 16)

  @Test fun rejectsInvalidLengthAndVersionBeforeBiometricPrompt() {
    val input = structuralFixture()
    assertTrue(runCatching {
      BiometricSqlCipherKeyEnvelopeLab.validateEnvelopeForLabOnly(input.copyOf(input.size - 1))
    }.exceptionOrNull() is BiometricSqlCipherKeyEnvelopeLab.Unavailable)

    input[4] = 2
    assertTrue(runCatching {
      BiometricSqlCipherKeyEnvelopeLab.validateEnvelopeForLabOnly(input)
    }.exceptionOrNull() is BiometricSqlCipherKeyEnvelopeLab.Unavailable)
  }

  @Test fun envelopeValidationDoesNotProvisionOrDeleteKeystoreAlias() {
    val alias = "negresco_disposable_biometric_wrap_lab_v1"
    fun present(): Boolean = KeyStore.getInstance("AndroidKeyStore").apply {
      load(null)
    }.containsAlias(alias)

    val before = present()
    // This is a format-only check, NOT proof of an authentic GCM tag.
    BiometricSqlCipherKeyEnvelopeLab.validateEnvelopeForLabOnly(structuralFixture())
    assertEquals(before, present())
  }
}
