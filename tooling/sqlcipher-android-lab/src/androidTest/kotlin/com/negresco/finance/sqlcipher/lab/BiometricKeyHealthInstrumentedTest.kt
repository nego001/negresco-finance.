package com.negresco.finance.sqlcipher.lab

import androidx.test.ext.junit.runners.AndroidJUnit4
import java.security.KeyStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Hardware-backed claims are NOT made here. No fingerprint enrollment or
 * genuine biometric acceptance is asserted by these read-only checks.
 */
@RunWith(AndroidJUnit4::class)
class BiometricKeyHealthInstrumentedTest {
  private fun exists(): Boolean =
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      .containsAlias("negresco_disposable_biometric_wrap_lab_v1")

  @Test fun inspectionNeverCreatesOrDeletesTheLabKey() {
    val before = exists()
    val first = BiometricKeyHealthLab.inspect()
    val second = BiometricKeyHealthLab.inspect()
    assertEquals("Read-only result must be stable without device changes", first, second)
    assertEquals("Inspection may not change alias existence", before, exists())
    if (!before) assertEquals(BiometricKeyHealthLab.State.MISSING, first)
  }

  @Test fun missingAndInvalidKeysNeverCauseAutomaticUnlockOrReplacement() {
    for (status in listOf(
      BiometricKeyHealthLab.State.MISSING,
      BiometricKeyHealthLab.State.INVALIDATED_OR_UNRECOVERABLE
    )) {
      assertEquals(
        BiometricRecoveryGateLab.Action.KEEP_ENCRYPTED_AND_REQUIRE_INDEPENDENT_RECOVERY,
        BiometricRecoveryGateLab.decide(status)
      )
    }
  }

  @Test fun unavailableKeystoreMustRemainLockedRatherThanProvisionKey() {
    val action = BiometricRecoveryGateLab.decide(BiometricKeyHealthLab.State.UNAVAILABLE)
    assertEquals(BiometricRecoveryGateLab.Action.KEEP_LOCKED_AND_RETRY_LATER, action)
    assertNotEquals(BiometricRecoveryGateLab.Action.ASK_FOR_BIOMETRIC, action)
  }

  @Test fun availableKeyStillNeedsCryptographicBiometricAuthorization() {
    assertEquals(
      BiometricRecoveryGateLab.Action.ASK_FOR_BIOMETRIC,
      BiometricRecoveryGateLab.decide(BiometricKeyHealthLab.State.AUTHENTICATION_REQUIRED)
    )
    // This policy result is not an authorized Cipher or a SQLCipher passphrase.
    assertTrue(BiometricRecoveryGateLab.Action.values().none {
      it.name.contains("UNLOCKED") || it.name.contains("RESET")
    })
  }
}
