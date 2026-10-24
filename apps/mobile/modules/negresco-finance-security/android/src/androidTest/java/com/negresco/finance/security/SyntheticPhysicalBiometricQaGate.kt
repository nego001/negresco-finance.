package com.negresco.finance.security

import android.os.Build
import java.util.Locale

/**
 * Physical QA TEST RUNNER gate, NEVER shipped or exported to JS.
 *
 * Conservative rejection of known emulators is not hardware attestation.
 * Passing this gate still requires a human reviewer, a separate authorized
 * test handset and genuine enrolled strong biometric consent.
 */
internal object SyntheticPhysicalBiometricQaGate {
  internal data class DeviceProfile(
    val fingerprint: String,
    val hardware: String,
    val product: String,
    val model: String,
    val brand: String,
    val manufacturer: String
  )

  internal enum class Verdict {
    DENY_NO_EXPLICIT_OPT_IN,
    DENY_KNOWN_EMULATOR,
    HUMAN_REVIEW_REQUIRED_NOT_ATTESTED
  }

  internal fun currentDevice(): DeviceProfile = DeviceProfile(
    Build.FINGERPRINT.orEmpty(), Build.HARDWARE.orEmpty(),
    Build.PRODUCT.orEmpty(), Build.MODEL.orEmpty(), Build.BRAND.orEmpty(),
    Build.MANUFACTURER.orEmpty()
  )

  internal fun classify(userOptIn: String?, device: DeviceProfile): Verdict {
    if (userOptIn != "YES_PHYSICAL_CONSENT") return Verdict.DENY_NO_EXPLICIT_OPT_IN
    val fingerprint = device.fingerprint.lowercase(Locale.ROOT)
    val hardware = device.hardware.lowercase(Locale.ROOT)
    val product = device.product.lowercase(Locale.ROOT)
    val model = device.model.lowercase(Locale.ROOT)
    val brand = device.brand.lowercase(Locale.ROOT)
    val manufacturer = device.manufacturer.lowercase(Locale.ROOT)

    val virtualized =
      hardware.contains("ranchu") ||
      hardware.contains("goldfish") ||
      hardware.contains("qemu") ||
      hardware.contains("vbox") ||
      fingerprint.startsWith("generic") ||
      fingerprint.contains("/generic") ||
      fingerprint.contains("/emulator") ||
      product.contains("sdk_gphone") ||
      product.startsWith("sdk") ||
      product.contains("emulator") ||
      model.contains("emulator") ||
      model.contains("android sdk built for") ||
      brand == "generic" ||
      manufacturer == "genymotion"

    return if (virtualized) Verdict.DENY_KNOWN_EMULATOR
      else Verdict.HUMAN_REVIEW_REQUIRED_NOT_ATTESTED
  }
}
