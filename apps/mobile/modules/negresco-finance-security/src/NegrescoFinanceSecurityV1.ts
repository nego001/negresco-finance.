import { requireOptionalNativeModule } from 'expo';

/**
 * Diagnostic discovery only. Expo modules are registered through the Expo
 * Modules API, not by manually guessing a React Native NativeModules slot.
 *
 * The returned object is UNTRUSTED at the JS boundary and may only be given
 * to inspectNativeFinanceReadiness(). No method authorizes storage or keys.
 */
export function getOptionalNativeFinanceDiagnosticHost(): unknown {
  try {
    return requireOptionalNativeModule('NegrescoFinanceSecurityV1');
  } catch {
    // Diagnostic host discovery must never crash Settings or authorize a key.
    return null;
  }
}
