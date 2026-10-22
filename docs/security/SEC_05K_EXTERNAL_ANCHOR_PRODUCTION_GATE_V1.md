# SEC-05K | Critérios de aceite de uma autoridade monotônica externa (v1)

**Situação:** DESENHO DE REQUISITOS. **BLOQUEADO PARA PRODUÇÃO.** PR #14 em draft. Nenhuma autoridade implantada, certificado provisionado, credencial real, APK, merge ou release decorre deste documento.

## Decisão e propriedade exigida

A recuperação/rekey de dados protegidos não pode aceitar uma geração anterior depois que uma geração posterior foi confirmada. A fonte de confiança necessária é uma **autoridade externa com registro monotônico e histórico de operações**, cuja geração não possa ser reduzida por um adversário que restaure o PostgreSQL, as duas testemunhas assinadas e seus backups, **incluindo backups da própria autoridade**.

O experimento de quatro domínios no SEC-05K demonstrou a limitação: PostgreSQL e três JVMs Ed25519, quando todos restaurados ao snapshot inicial, tornam-se indistinguíveis de uma execução sem CAS. Assinatura válida e nonce novo autenticam apenas a resposta corrente do processo restaurado. Acrescentar réplicas no mesmo domínio administrativo ou proteger apenas a chave de assinatura em HSM não preserva o contador.

É proibido converter testemunho de fixture, alegação de fornecedor, checklist preenchido ou concordância entre snapshots em `VERIFIED_LIVE_CURRENT`. O laboratório `SyntheticExternalAnchorAssuranceGateLabTest.kt` emite exclusivamente razões DENY/HOLD e sempre exige validação independente; **não contém caminho ALLOW**.

## Contrato mínimo de confiança e implantação

| Área | Evidência que seria exigida | Condição de falha |
|---|---|---|
| Identidade | Chave/raiz provisionada de forma autenticada fora do próprio canal de resposta; rotação com época e autorização explícita | Chave self-attested, pin ausente/trocado, época inesperada: DENY |
| Registro de geração | Histórico monotônico externo ao conjunto restaurável; evidência testável de proteção contra restore total da própria autoridade | Estado em disco/SQL restaurável, ainda que assinado por HSM: HOLD |
| Domínio de falha | Independência real de operador, credenciais, administrador, backup, política de retenção e comprometimento | Mesmo administrador consegue reverter todas as provas: HOLD |
| Concorrência | CAS linearizável de geração e recibo idempotente (conta, UUID operação, predecessor, sucessor, hash do ciphertext) confirmado atomicamente | Colisão, predecessor stale, resposta perdida sem recibo durável: DENY/HOLD |
| Consulta | Resposta Ed25519 vinculada a conta, kit, versão, geração, hash, desafio, identidade/época e commit identificável | Assinatura antiga, desafio reusado, claim divergente ou resposta não associada ao commit: DENY |
| Limite temporal | Verificação transacional no ponto de decisão; quote anterior não concede permissão futura de publicar journal | TOCTOU entre quote e commit: HOLD |
| Recuperação | Crash/power-loss, restore privilegiado de backups antigos, full loss, reconstrução do cluster e recuperação testados e auditados | Reseed silencioso, reset de contador ou perda não reconciliada de prova: HOLD |
| Governança | Autorização real do titular, segregação de funções, trilha de auditoria externa, gestão de incidentes e revisão independente | Ausência de titular autenticado ou apenas declarações locais: HOLD |

A viabilidade técnica de cada opção de armazenamento deve ser demonstrada documentalmente e por testes reproduzíveis no domínio de ameaça escolhido. *Object Lock/WORM*, ledger append-only, replicação e HSM são **componentes possíveis**, não garantias automáticas contra privilégios de superadministrador, retenção expirada, rollback lógico ou perda de identidades.

## Protocolo proposto (ainda não implementado)

1. **Provisionamento**: registrar fora do aplicativo uma raiz de confiança e uma época de autoridade. Reprovisionamento ou substituição requer cerimônia explícita auditável; nunca adotar chave recebida pela conexão sem prova independente.
2. **Pré-condição de rekey**: preparar candidato SQLCipher/backup externo e journal durável, sem publicação, mantendo ambos os metadados de OLD e NEW vinculados a um UUID único.
3. **Commit monotônico**: autoridade confirma CAS de OLD para NEW e grava recibo/commit sob garantias externas de persistência e ordenação; uma resposta perdida deve ser esclarecida por consulta de UUID e geração **à mesma autoridade confiável**.
4. **Reconciliação**: comparar hash/kit/versão/geração do journal, SQLCipher e autoridade, autenticando conta e titular no momento da operação. Se qualquer evidência faltar, houver divergência ou a autoridade estiver offline: bloquear publicação, limpeza do journal e novo enrollment.
5. **Recuperação**: nunca reconstruir a geração atual de apenas snapshots reversíveis. Exigir operação supervisionada, identidade/provas externas e auditoria antes de qualquer decisão sensível.

Essa sequência ainda **não** é uma transação distribuída segura: não existem aqui garantia de commit end-to-end, serviço implantado, prova de disponibilidade, canal protegido de administração, recuperação material de chave ou política financeira real.

## Critérios de saída do gate

- [ ] Escolher arquitetura de armazenamento monotônico e publicar modelo de ameaças com limites de controle do administrador/backup.
- [ ] Demonstrar que rollback do **próprio registro/backup da autoridade** não reduz geração nem apaga irreversivelmente a prova de commit, ou documentar como o evento é detectado e causa HOLD.
- [ ] Provisionar identidade pública por canal independente e auditar rotação/época, inclusive perda total da autoridade.
- [ ] Demonstrar concorrência linearizável e idempotência sob crash entre CAS/recibo/ACK, com testes de *power loss* e partição de rede.
- [ ] Testar reinício, restauração conjunta de PostgreSQL + testemunhas + autoridade, corrupção e comprometimento administrativo conforme ameaça.
- [ ] Validar titular autorizado, cerimônia de backup externo, confidencialidade, revogação e observabilidade sem vazar segredos.
- [ ] Fazer auditoria independente e integrar ao app somente depois de QA Android/SQLCipher real e revisão de segurança.
- [ ] Preservar bloqueio por padrão em ausência de prova, e evidenciar que rollback detectado não se torna auto-recovery.

## Regras operacionais durante SEC-05K

**Nunca** fazer merge da PR #14, publicar APK ou alterar a PR #17 para apresentar estes testes como sistema funcional. Manter todos os testes como fixtures sintéticos isolados. Qualquer passo marcado acima só é concluído com evidência verificável; checkbox ou assinatura local não bastam.

**Referências internas:** `SEC_05K_DURABLE_REKEY_JOURNAL_LAB.md`, `SyntheticJdbcAllDomainsRollbackIndistinguishabilityLabTest.kt`, `SyntheticExternalAnchorAssuranceGateLabTest.kt`, `SyntheticJournalAuthorityReconciliationPolicyLab.kt`.
