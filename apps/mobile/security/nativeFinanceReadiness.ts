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
): Promise<NativeFinanceReadiness> {
  if (platform !== 'android') {
    return outcome(
      'unsupported-platform',
      'Diagnóstico nativo Android indisponível nesta plataforma. Nenhuma proteção financeira foi habilitada.',
    );
  }

  if (
    rawHost === null ||
    typeof rawHost !== 'object' ||
    typeof (rawHost as NativeDiagnosticHost).getIntegrationInfo !== 'function'
  ) {
    return outcome(
      'native-module-absent',
      'Proteção financeira nativa ainda não integrada ao aplicativo. SQLCipher e Keystore seguem em laboratório, fora deste APK.',
    );
  }

  try {
    // Host não confiável: não interpretar qualquer alegação de "ready",
    // versão, assinatura, sucesso, biometria ou acesso à chave como prova.
    await (rawHost as NativeDiagnosticHost).getIntegrationInfo!();
    return outcome(
      'native-lab-only',
      'Interface diagnóstica nativa encontrada. Integração financeira continua BLOQUEADA até testes de chaves, banco, recuperação e homologação física.',
    );
  } catch {
    return outcome(
      'native-diagnostic-error',
      'Falha na consulta diagnóstica do módulo nativo. Nenhum dado financeiro foi acessado ou liberado.',
    );
  }
}
