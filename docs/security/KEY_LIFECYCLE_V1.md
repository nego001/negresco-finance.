# Negresco Finance | Política de chaves V1 (Fase 1)

**Status: contrato lógico implementado; chaves nativas NÃO provisionadas.**
Código em `packages/security-core/src/key-lifecycle.mjs`, testado no CI.
Esta política não cria, cifra, recupera, armazena nem autoriza desbloqueio de
chaves reais; chamar `transitionKeyState` **nunca substitui uma atestação
criptográfica nativa**.

## Compartimentos de chaves

| Domínio | Finalidade | Proteção pretendida |
| --- | --- | --- |
| `sqlcipher-page` | Chave de páginas do banco SQLCipher local | Aleatória, única e envolvida por chave protegida no Android Keystore |
| `e2ee-root` | Derivação de chaves por registro/domínio | Aleatória e independente, protegida em dispositivo autorizado |
| `offline-recovery-wrap` | Recuperação E2EE sem entregar material ao servidor | Envelope de recuperação offline autenticado, separado dos demais |

Cada identidade possui **alias exclusivo, versão positiva e política de
não exportação**. Não permitir alias duplicado ou reaproveitamento da mesma
chave em banco e E2EE. O manifest guarda apenas metadados: não pode conter
senhas, chaves em Base64, PIN, seeds ou plaintext. O backend não recebe
chaves ou permissões de descriptografia.

## Ciclo de vida e falhas

- `NOT_CREATED` só passa a `SEALED` após provisionamento aleatório real
  verificado no nativo. Nunca provisionar usando `Math.random`, PIN nem
  biometria como fonte de entropia.
- `SEALED` só passa a `UNSEALED` após autorização **nativa** e acesso
  protegido ao material criptográfico no próprio aparelho.
- Em segundo plano ou bloqueio manual, `UNSEALED` volta a `SEALED`.
  Confirmar que buffers em memória são zerados e chamadas concorrentes param.
- Em mudança/invalidação de biometria, exigir `RECOVERY_REQUIRED`. Não
  considerar nova digital como autenticação da chave antiga.
- Para recuperar, exigir prova offline de recuperação e reenvolvimento
  autenticado. Se não houver prova, manter os dados cifrados sem reset
  silencioso. Falhas de armazenamento, rollback ou versões desconhecidas
  devem **falhar fechado**, nunca cair para SQLite comum.

## Critérios para integrar o código ao aplicativo

- [ ] Implementar o **adaptador nativo Android** responsável por gerar,
  envolver, rotacionar e excluir chaves, com interfaces de mínimo privilégio.
- [ ] Testar Android Keystore real com mudança de impressão digital, biometria
  cancelada, perda de aparelho e política de recuperação.
- [ ] Construir e testar SQLCipher nativo no app, sem fallback plaintext.
- [ ] Demonstrar separação de chaves com inspeção de binário, memória, logs,
  WAL, backups e armazenamento temporário.
- [ ] Implementar recuperação E2EE verificável sem entregar a raiz ao
  backend ou IA; auditar metadados expostos.
- [ ] Auditabilidade independente, CI nativo e homologação no Samsung real.

**Os testes unitários da política não aprovam nenhuma dessas caixas.**
Esta implementação é exclusiva do Negresco Finance, conforme
[ADR 0001](../decisions/0001-sqlcipher-zero-knowledge-negresco-only.md).
