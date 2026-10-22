package com.negresco.finance.security

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Expo SDK 54 LOCAL DIAGNOSTIC ONLY.
 *
 * The native code has NO financial storage, no key access and no authority.
 * No authorization may be derived from the JS-visible dictionary. Connecting
 * SQLCipher requires a separate native-only policy and full physical QA.
 */
class NegrescoFinanceSecurityV1Module : Module() {
  override fun definition() = ModuleDefinition {
    Name("NegrescoFinanceSecurityV1")

    // This is read-only, accepts no caller-supplied identity, money, key or
    // permission flag. All booleans are hardcoded false on the Kotlin side.
    AsyncFunction("getIntegrationInfo") {
      mapOf(
        "protocolVersion" to 1,
        "moduleKind" to "DIAGNOSTIC_ONLY",
        "financialStorageAllowed" to false,
        "keyReleaseAllowed" to false,
        "migrationAllowed" to false,
        "sqlcipherIntegrated" to false,
        "hardwareKeyAuthorizationIntegrated" to false
      )
    }
  }
}
