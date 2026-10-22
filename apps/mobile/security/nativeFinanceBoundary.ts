/**
 * SEC-05K to Expo integration boundary, V0 (DIAGNOSTIC ONLY).
 *
 * Reading React Native NativeModules is NOT an authorization channel. Even a
 * candidate with success=true or canAccessFinancialData=true remains blocked:
 * an untrusted JS value cannot prove a SQLCipher key is bound to Keystore,
 * biometric authorization, a durable transaction or a genuine external floor.
 *
 * This file NEVER reads/writes balances, ciphertext, secrets, authentication
 * tokens, AsyncStorage or SecureStore. It has no unlock/enable/fallback API.
 * A later native implementation must enforce authorization in Kotlin, before
 * a key or sensitive database operation is allowed, with a reviewed upgrade.
 */
export const NATIVE_FINANCE_MODULE_NAME = 'NegrescoFinanceSecureCore' as const;

export type NativeFinanceDiagnosticStatus =
  | 'UNSUPPORTED_PLATFORM'
  | 'NATIVE_MODULE_ABSENT'
  | 'INVALID_NATIVE_MODULE_CANDIDATE'
  | 'NATIVE_MODULE_UNVERIFIED';

export type NativeFinanceDiagnostic = Readonly<{
  status: NativeFinanceDiagnosticStatus;
  financialDataAccess: 'BLOCKED';
  authorizedByNativeKeystore: false;
  message: string;
}>;

/** UI-only observation; NEVER convert it to permission to persist sensitive data. */
export function inspectNativeFinanceBoundary(
  platform: string,
  candidate: unknown
): NativeFinanceDiagnostic {
  if (platform !== 'android') {
    return {
      status: 'UNSUPPORTED_PLATFORM',
      financialDataAccess: 'BLOCKED',
      authorizedByNativeKeystore: false,
      message: 'Cofre financeiro nativo indisponível nesta plataforma. Dados financeiros reais continuam bloqueados.'
    };
  }
  if (candidate == null) {
    return {
      status: 'NATIVE_MODULE_ABSENT',
      financialDataAccess: 'BLOCKED',
      authorizedByNativeKeystore: false,
      message: 'Cofre financeiro nativo ainda não conectado ao aplicativo. SQLCipher e autorização por chave permanecem fora desta prévia.'
    };
  }
  if (typeof candidate !== 'object' && typeof candidate !== 'function') {
    return {
      status: 'INVALID_NATIVE_MODULE_CANDIDATE',
      financialDataAccess: 'BLOCKED',
      authorizedByNativeKeystore: false,
      message: 'Conexão nativa inválida. Acesso a dados financeiros reais bloqueado.'
    };
  }
  // Do not inspect getters, version flags, promises or booleans on candidate:
  // any of them can be forged from JS or returned by an old native build.
  return {
    status: 'NATIVE_MODULE_UNVERIFIED',
    financialDataAccess: 'BLOCKED',
    authorizedByNativeKeystore: false,
    message: 'Módulo nativo detectado, mas sem contrato de segurança homologado. Nenhum armazenamento financeiro real está autorizado.'
  };
}
