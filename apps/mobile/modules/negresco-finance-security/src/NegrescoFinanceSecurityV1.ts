import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Diagnostic discovery only. Expo modules are registered through the Expo
 * Modules API, not by manually guessing a React Native NativeModules slot.
 *
 * The returned object is UNTRUSTED at the JS boundary and may only be given
 * to inspectNativeFinanceReadiness(). No method authorizes storage or keys.
 */
export function getOptionalNativeFinanceDiagnosticHost(): unknown {
  return requireOptionalNativeModule('NegrescoFinanceSecurityV1');
}
