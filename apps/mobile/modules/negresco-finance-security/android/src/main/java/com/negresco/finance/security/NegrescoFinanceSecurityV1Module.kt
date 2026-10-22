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
  // Native lifecycle signals are revocation-only. There is no grant API.
  private val diagnosticLifecycle = NativeLockLifecycleFence()

  override fun definition() = ModuleDefinition {
    Name("NegrescoFinanceSecurityV1")

    OnActivityEntersForeground { diagnosticLifecycle.onForeground() }
    OnUserLeavesActivity { diagnosticLifecycle.onBackground() }
    OnActivityEntersBackground { diagnosticLifecycle.onBackground() }
    OnActivityDestroys { diagnosticLifecycle.onDestroyed() }
    OnDestroy { diagnosticLifecycle.onDestroyed() }

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

    // Metadata only: never opens, creates, validates or recovers lock records.
    // Deliberately does not expose enabled/revision/session or secret values.
    AsyncFunction("inspectNativeLockStorePresence") {
      // Background/leave/destroy can occur even while the file metadata is
      // inspected. A stale result is never returned as a current observation.
      val epoch = diagnosticLifecycle.beginDiagnosticEpoch()
      val untrustedStatus = if (epoch == null) "UNAVAILABLE"
        else NativeLockFilePresenceDiagnostic.inspect(appContext.reactContext)
      val status = if (epoch != null && diagnosticLifecycle.isStillDiagnosticEpoch(epoch))
        untrustedStatus else "UNAVAILABLE"
      mapOf(
        "status" to status,
        "financialStorageAllowed" to false,
        "keyReleaseAllowed" to false,
        "migrationAllowed" to false
      )
    }
  }
}
