import { requireOptionalNativeModule } from 'expo';

/**
 * Expo Modules API SDK 54: prefer the optional native module registry instead
 * of React Native's legacy NativeModules lookup. Missing module is expected
 * for APK builds created before this native source was added.
 *
 * Diagnostic data must NEVER be interpreted as user authorization.
 */
export function getNativeFinanceDiagnosticHost(): unknown {
  try {
    return requireOptionalNativeModule('NegrescoFinanceSecurityV1');
  } catch {
    // On unsupported runtimes, diagnostics remain unavailable and fail closed.
    return null;
  }
}
