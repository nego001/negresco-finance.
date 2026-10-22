/**
 * Fase 1 — inspeção SOMENTE LEITURA do futuro módulo financeiro nativo.
 *
 * Não é um verificador de integridade, autenticidade ou autorização. O host
 * pode ser injetado ou falsificado pelo JavaScript. Mesmo uma resposta
 * aparentemente válida jamais libera banco, chave, biometria ou migração.
 */
export type NativeFinanceReadinessStatus =
  | 'unsupported-platform'
  | 'native-module-absent'
  | 'native-diagnostic-error'
  | 'native-lab-only';

export type NativeFinanceReadiness = Readonly<{
  status: NativeFinanceReadinessStatus;
  message: string;
  financialStorageAllowed: false;
  keyReleaseAllowed: false;
  migrationAllowed: false;
}>;

type NativeDiagnosticHost = Readonly<{
  getIntegrationInfo?: () => unknown | Promise<unknown>;
}>;

function outcome(
  status: NativeFinanceReadinessStatus,
  message: string,
): NativeFinanceReadiness {
  return Object.freeze({
    status,
    message,
    financialStorageAllowed: false,
    keyReleaseAllowed: false,
    migrationAllowed: false,
  });
}

/**
 * Executar manualmente na tela Ajustes, nunca no boot ou em resposta
 * a uma solicitação de armazenamento. Não enviar dados financeiros ao host.
 *
 * O diagnóstico é apenas informativo: não tem como conceder autorização.
 */
export async function inspectNativeFinanceReadiness(
  platform: string,
  rawHost: unknown,
  diagnosticTimeoutMs = 5000,
): Promise<NativeFinanceReadiness> {
  if (platform !== 'android') {
    return outcome(
      'unsupported-platform',
      'Diagnóstico nativo Android indisponível nesta plataforma. Nenhuma proteção financeira foi habilitada.',
    );
  }

  if (rawHost === null || typeof rawHost !== 'object') {
    return outcome(
      'native-module-absent',
      'Proteção financeira nativa ainda não integrada ao aplicativo. SQLCipher e Keystore seguem em laboratório, fora deste APK.',
    );
  }

  // Reading a property on an untrusted native host may itself throw.
  // Keep this inside the fail-closed handler, including hostile JS proxies.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const probe = (rawHost as NativeDiagnosticHost).getIntegrationInfo;
    if (typeof probe !== 'function') {
      return outcome(
        'native-module-absent',
        'Proteção financeira nativa ainda não integrada ao aplicativo. SQLCipher e Keystore seguem em laboratório, fora deste APK.',
      );
    }
    const duration = Number.isFinite(diagnosticTimeoutMs) && diagnosticTimeoutMs >= 1
      ? Math.min(diagnosticTimeoutMs, 5000) : 5000;

    // This is a manual, read-only probe. A lost reply must not keep Settings
    // busy indefinitely. The native request may still finish later, but its
    // result is ignored and NEVER becomes an authorization for JS/SQLCipher.
    await Promise.race([
      Promise.resolve().then(() => probe.call(rawHost)),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('diagnostic timeout')), duration);
      }),
    ]);
    // Host não confiável: não interpretar qualquer alegação de "ready",
    // versão, assinatura, sucesso, biometria ou acesso à chave como prova.
    return outcome(
      'native-lab-only',
      'Interface diagnóstica nativa encontrada. Integração financeira continua BLOQUEADA até testes de chaves, banco, recuperação e homologação física.',
    );
  } catch {
    return outcome(
      'native-diagnostic-error',
      'Falha ou tempo esgotado na consulta nativa. Nenhum dado financeiro foi acessado ou liberado.',
    );
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
