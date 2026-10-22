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

export type NativeStorePresence = 'not-checked' | 'absent' | 'present-unverified' | 'unsafe-entry' | 'unavailable';

export type NativeFinanceReadiness = Readonly<{
  status: NativeFinanceReadinessStatus;
  message: string;
  financialStorageAllowed: false;
  keyReleaseAllowed: false;
  migrationAllowed: false;
  storePresence: NativeStorePresence;
}>;

type NativeDiagnosticHost = Readonly<{
  getIntegrationInfo?: () => unknown | Promise<unknown>;
  inspectNativeLockStorePresence?: () => unknown | Promise<unknown>;
}>;

function outcome(
  status: NativeFinanceReadinessStatus,
  message: string,
  storePresence: NativeStorePresence = 'not-checked',
): NativeFinanceReadiness {
  return Object.freeze({
    status,
    message,
    financialStorageAllowed: false,
    keyReleaseAllowed: false,
    migrationAllowed: false,
    storePresence,
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
    const storeObservation = await Promise.race([
      Promise.resolve().then(async () => {
        await probe.call(rawHost);
        // Only reads optional metadata. The returned JS object is untrusted.
        const inspector = (rawHost as NativeDiagnosticHost).inspectNativeLockStorePresence;
        return typeof inspector === 'function' ? inspector.call(rawHost) : null;
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('diagnostic timeout')), duration);
      }),
    ]);
    // The only data projected to UI is a bounded set of UNVERIFIED labels.
    // A hostile JS/native host may forge all of these values.
    let presence: NativeStorePresence = 'not-checked';
    if (storeObservation && typeof storeObservation === 'object') {
      const status = (storeObservation as {status?: unknown}).status;
      if (status === 'ABSENT') presence = 'absent';
      else if (status === 'PRESENT_UNVERIFIED') presence = 'present-unverified';
      else if (status === 'UNSAFE_ENTRY') presence = 'unsafe-entry';
      else if (status === 'UNAVAILABLE') presence = 'unavailable';
    }
    const labels: Record<NativeStorePresence, string> = {
      'not-checked': 'Arquivo DataStore não inspecionado.',
      absent: 'Nenhum arquivo nativo de bloqueio detectado nesta inspeção.',
      'present-unverified': 'Arquivo de bloqueio detectado, mas NÃO validado nem autenticado.',
      'unsafe-entry': 'Entrada de armazenamento potencialmente insegura. Não usar.',
      unavailable: 'Não foi possível verificar a presença do arquivo nativo.',
    };
    return outcome(
      'native-lab-only',
      'Interface diagnóstica nativa encontrada. Integração financeira continua BLOQUEADA até testes de chaves, banco, recuperação e homologação física. ' + labels[presence],
      presence,
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
