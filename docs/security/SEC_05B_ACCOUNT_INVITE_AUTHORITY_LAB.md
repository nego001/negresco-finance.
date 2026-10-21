# SEC-05B | Autoridade de convites por conta (laboratório somente)

**Data:** 21/10/2026  
**Trilha:** SEC-05, Confiança de dispositivos, **não** SEC-06 (Modo Proteção Máxima).  
**Código:** `tooling/native-lock-spike/.../SyntheticAccountInviteAuthorityLab.kt`  
**Execução:** `gradle -p tooling/native-lock-spike policyCheck --no-daemon`

> **Não existe backend real, banco transacional de servidor, API, autenticação de conta ou armazenamento anti-rollback neste experimento.** O objeto Kotlin simula, em memória e com dados descartáveis, decisões de uma autoridade remota. Nunca ligar a Expo, dispositivo de usuário, chaves financeiras ou produção.

## Objetivo específico

Modelar e testar as invariantes que um futuro serviço de confiança precisaria preservar, sem apresentar um DataStore local como autoridade da conta.

1. **Escopo por conta:** identificadores opacos sintéticos; convites são indexados por par `(accountId, invitationId)`. Ler/consumir pelo identificador de outra conta é recusado.
2. **Emissão:** um único convite pendente por conta; desafio aleatório de 32 bytes; associação ao aprovador, candidato, revisão, época e sequência.
3. **Prazo:** cinco minutos segundo relógio **substituível de laboratório**. Expiração no instante limite cria um estado terminal; cancelar tarde não substitui `EXPIRED`.
4. **Assinaturas:** verificação Ed25519 real do aprovador previamente cadastrado **na fixture** e prova do candidato sobre o desafio. Chaves incorretas, nonce alterado e reutilização falham.
5. **Atomicidade simulada:** `synchronized(mutex)` serializa chamadas na mesma instância JVM. Apenas uma concorrente consome o desafio; o contador do aprovador é avançado.
6. **Revogação:** método explícito **somente fixture** invalida convites pendentes, retira o aprovador ativo e aumenta revisão/época. Não representa uma requisição autenticada.
7. **Anti-rollback como política:** estado apresentado é comparado integralmente com a fotografia corrente **da fixture**. Match exato significa apenas coerência sintética, nunca permissão.
8. **Sem concessão:** `CONSUMED_PROOF_ONLY` não inclui o candidato em `active`, não emite token, não abre SQLCipher e não autoriza operação financeira.

## Lacunas deliberadas de segurança

| Controle necessário em produção | Situação |
| --- | --- |
| Persistência transacional durável compartilhada por todas as instâncias da autoridade | **Ausente**. Memória desaparece no restart e não existe quorum/replicação. |
| Identidade de conta autenticada por sessão/token externo com prevenção de confusão entre contas | **Ausente**. Identificadores das fixtures não autenticam ninguém. |
| Aprovação forte e recente do titular, com prevenção de fraude e política de recuperação | **Ausente**. O método da fixture não comprova consentimento. |
| Binding criptográfico **explícito** da conta e do identificador do convite nos dois payloads assinados | **Pendente**. O payload Ed25519 reutilizado do SEC-05 vincula fingerprints/revisão/epoch/nonce, **não** conta/ID. O nonce aleatório e índice por conta ajudam o laboratório, mas não substituem um formato de produção com domínio, conta e convite assinados. |
| Tempo confiável de servidor, validade única e retenção/purga de tombstones | **Ausente**. O relógio é injetado pelo teste. |
| Certificado e chave pública da autoridade provisionados por canal confiável, rotação e assinatura de recibos | **Ausente**. Não há emissor, HSM, recibo remoto autenticado ou pinning. |
| Resiliência contra restauração de backup/rollback remoto, interrupção após commit e múltiplos nós | **Ausente**. Mutex JVM não é transação ACID distribuída. |
| Persistência de chave privada por hardware, registro seguro do primeiro aparelho, atestação, revogação de sessões, auditoria e rate limiting | **Ausente**. Todos os pares de chaves dos testes são software descartável. |
| Sincronização/recuperação E2EE e validação independente de app físico | **Ausente**. Nenhum segredo financeiro participa dos testes. |

## Esboço da arquitetura necessária fora deste laboratório

```text
App candidato -- gera chave nativa --> desafio solicitado à autoridade
                                           |
                                   autenticação da conta
                                           |
              registro durável do convite (nonce, escopo, TTL, revisão)
                                           |
App aprovador -- autorização forte do titular --> assinatura account+invite+nonce+contexto
App candidato -------------------------------> assinatura account+invite+nonce+contexto
                                           |
                             transação central única:
                             validar revisões e revogações
                             verificar duas assinaturas
                             consumir nonce e sequência
                             registrar nova chave pública
                             atualizar epoch/revision
                                           |
                     recibo autenticado + política de atualização local
```

Essa arquitetura é um **projeto de protocolo**, não código de produção pronto. O passo de consumo real deve impor uma transação com unicidade persistente de nonce e sequência por conta, autenticação do usuário e verificação de permissão vigente. Requisições repetidas e concorrentes não podem criar aparelhos extras. Uma queda do serviço entre commit e resposta deve ser tratada com idempotência vinculada à conta e sem reexecutar o cadastro.

O acesso offline não pode aceitar como frescos convites ou revogações que dependem de autoridade online. A perda de todos os aparelhos precisa de recuperação separada, com procedimentos de identidade, chaves e revogação definidos e testados. Em hipótese alguma o app deve criar um novo aparelho confiável só porque o último dispositivo sumiu.

## Evidência e limites de QA

- 25 cenários Kotlin/JVM incluem assinaturas verdadeiras de chaves descartáveis, replay, prazo, clock invertido, cancelamento tardio, contas diferentes, sequência monotônica, revogação, snapshot antigo e concorrência.
- `tests/security-account-invite-authority-contract.test.mjs` impede a remoção silenciosa das invariantes e confirma que o laboratório não está importado no Expo.
- O relatório deste estágio só pode dizer **"testes aprovados" quando os jobs da revisão atual concluírem com sucesso**.
- A implementação não altera APK, assinatura, banco do usuário, `main`, ou qualquer dispositivo cadastrado.

**Status de segurança:** PROTÓTIPO ISOLADO. Gate SEC-05 de autoridade remota real continua **BLOQUEADO**.
