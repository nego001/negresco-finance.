# SEC-05E | Assinaturas Ed25519 na mesma transação PostgreSQL (laboratório)

**Data:** 21/10/2026  
**Área:** SEC-05, Confiança de dispositivos. SEC-06 continua reservado ao Modo Proteção Máxima.  
**Execução:** GitHub Actions, job `authority-postgres-lab`, tarefa Gradle `pgBoundProofCheck`.

> **Laboratório somente.** Não existe serviço de autenticação de usuário, sessão real, backend de produção, aprovação forte do titular, HSM, atestação Android ou registro efetivo de dispositivo neste fluxo. O exercício **não cadastra nenhum aparelho** e não produz nenhuma permissão financeira.

## Problema resolvido neste estágio de teste

O SEC-05D demonstrou serialização do ledger usando oito conexões PostgreSQL, mas o código SQL de ensaio não verificava assinaturas. O SEC-05E acrescenta uma execução completa de teste JVM/JDBC que:

1. Abre uma transação PostgreSQL em `READ COMMITTED` e bloqueia primeiro a linha da conta por `SELECT ... FOR UPDATE`.
2. Busca o convite da mesma conta com bloqueio, e consulta **tempo do próprio banco após adquirir o lock**.
3. Confere convite `PENDING`, prazo de cinco minutos, revisão, época, geração sintética do titular, aprovador ainda `ACTIVE`, sequência nova, nonce SHA-256 e candidato não cadastrado.
4. Carrega **do próprio banco** as chaves públicas Ed25519 X.509/SPKI previamente inseridas pela fixture, vinculadas à conta, e exige fingerprints exatos.
5. Verifica **duas assinaturas reais** pelo `SyntheticAccountBoundInviteProofLab` sobre o payload canônico: conta, UUID do convite, aprovador, candidato, revisão, época, sequência, nonce e domínios distintos para cada papel.
6. Somente após a verificação atualiza **na mesma transação JDBC** o contador do aprovador, revisão/época, tombstone `CONSUMED` e recibo de idempotência.
7. Faz commit ou rollback de tudo. Uma falha injetada **depois das atualizações, mas antes do commit** precisa deixar o registro exatamente como era.

**Não há inserção de novo dispositivo:** o estado de sucesso chama-se `RECORDED_SIGNED_PROOF_FIXTURE_ONLY`. Isso não é `ENROLLED`, login, desbloqueio, nem autorização para operações financeiras.

## Matriz de teste

- Assinaturas verdadeiras das duas chaves descartáveis aceitas no contexto correto.
- Assinaturas alteradas, outro UUID, outra conta e nonce incorreto recusados sem consumir convite.
- Injeção de falha imediatamente antes do commit e verificação de rollback integral.
- Oito conexões JDBC concorrentes: um commit inicial, sete recibos sem nova autorização.
- Repetição após resposta perdida não altera o contador; chave de idempotência usada em outro convite é negada.
- Expiração no tempo do banco; aprovador revogado; geração de titular incorreta.
- Teste verifica que o candidato jamais aparece em `devices`.

O driver PostgreSQL está em `testImplementation` do módulo JVM isolado. O código do ensaio fica **somente em `src/test`**, sem importação no Expo, pacote Android ou APK.

## Limitações obrigatórias

A `ownerGenerationFixture` não é autenticação. O código assume uma conta definida pela fixture e não tem camada autenticadora. **A autenticação real do titular é BLOQUEADA e ainda não foi implementada.**

Esta arquitetura ainda exige servidor com sessões account-bound e MFA/reauth forte; aprovação explícita do titular; registro/autenticação confiável do primeiro aparelho; controles antifraude, rate limits, auditoria minimizada e autorização independente. Não basta que duas chaves assinem um desafio, pois o candidato não comprova ser pessoa autorizada.

A transação demonstra exclusão mútua com `READ COMMITTED` e lock de conta. Não afirma oferecer `SERIALIZABLE` com retry em ambiente distribuído, nem protege restauração de backup do PostgreSQL, failover, comprometimento de chave de autoridade ou rollback de dados fora do banco.

Também permanecem pendentes: recuperação na perda de todos os aparelhos sem confiar em dispositivo inexistente, liberação segura de novo dispositivo apenas após autenticação forte e auditoria, recibo remoto assinado, política offline, Android Keystore/biometria física e pentest.

**Status:** SEC-05E em laboratório. Somente registrar como aprovado quando GitHub Actions do HEAD tiver executado `pgBoundProofCheck` com sucesso. SEC-05 de produção continua **BLOQUEADO**.
