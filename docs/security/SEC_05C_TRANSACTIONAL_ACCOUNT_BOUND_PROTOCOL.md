# SEC-05C | Vínculo criptográfico de conta e protocolo transacional

**Data:** 21/10/2026  
**Área correta:** SEC-05, Confiança de dispositivos (SEC-06 permanece Modo Proteção Máxima).  
**Escopo:** experimentos JVM isolados e esquema SQL proposto, **sem backend implementado**.

> ATENÇÃO: nada aqui cria contas reais, instala APK, protege operações bancárias, autentica titulares ou libera dispositivos. As chaves dos testes são efêmeras e geradas em software. O modelo PostgreSQL ainda não foi aplicado/testado em banco, e não existe API de produção.

## Parte A | Prova de posse vinculada à conta e ao convite

`SyntheticAccountBoundInviteProofLab.kt` define o payload **canônico binário v1** assinado independentemente por **aprovador e candidato** com Ed25519.

| Campo assinado | Tipo e comportamento |
| --- | --- |
| Domínio | ASCII length-prefixed, distinto para aprovador/candidato |
| Formato | Versão inteira 1, ordem fixa e DataOutputStream big-endian |
| Conta | Identificador hexadecimal minúsculo de 16 bytes, **fixture não autenticada** |
| Convite | UUID canônico de 16 bytes, gerado antes da assinatura |
| Aprovador | Fingerprint SHA-256 de SPKI Ed25519 canônico de 32 bytes |
| Candidato | Fingerprint SHA-256 de SPKI Ed25519 canônico de 32 bytes |
| Revisão / época | Inteiros de 64 bits, positivos, consistentes |
| Sequência do aprovador | Inteiro de 64 bits, positivo, menor que Long.MAX_VALUE |
| Nonce | 32 bytes, tamanho explícito, gerado por SecureRandom no laboratório |

A assinatura do aprovador **não** substitui a assinatura do candidato. A prova gerada para conta A ou convite X é inválida em conta B ou convite Y, mesmo que as demais chaves, nonce e campos coincidam.

O consumo no `SyntheticAccountInviteAuthorityLab.kt` agora usa **esta prova account-bound**, em vez de aceitar as assinaturas do protocolo anterior, que não codificavam conta e ID de convite. A emissão ainda usa o pré-voo anterior apenas para conferir a fixture antes de emitir o desafio.

O retorno `PROOF_VERIFIED_ONLY` comprova exclusivamente uma verificação criptográfica local de teste, **nunca** matrícula de novo dispositivo.

## Parte B | Modelo durável proposto, não implantado

Arquivo: `tooling/security-authority-protocol-lab/postgres/001_sec05c_schema.sql`.

Tabelas desenhadas: `accounts`, `devices`, `invites`, `enrollment_receipts`. Há escopo por conta nas chaves compostas, constraint de prazo de cinco minutos, nonce guardado apenas como digest, estados terminais, unicidade de nonce, unicidade de convite pendente por conta e recibo único para cada commit/idempotência.

**Apenas DDL sem execução.** Não há PostgreSQL em execução, migrations de produção, conexão ao banco, integração de API ou teste de isolamento ACID entre processos. Restrições de banco não verificam assinaturas, sessão autenticada, cadastro legítimo ou se a chave pública SPKI é canônica. Isso precisa de código seguro no servidor.

### Fluxo transacional esperado de um futuro backend

1. **Identificar e autenticar o titular no servidor** com sessão account-bound, autorização forte recente e políticas antifraude independentes. Nunca aceitar `accountId`, `approvedKey` ou `ownerAuthenticated=true` declarados por aplicativo/IA como prova.
2. **Emitir**: gerar nonce de 32 bytes por CSPRNG seguro. Iniciar `SERIALIZABLE`, bloquear a linha da conta com `SELECT ... FOR UPDATE`, marcar convites antigos vencidos com relógio do banco, verificar aprovador ativo e sequência, rejeitar candidato já cadastrado ou revogado, inserir convite com UUID único e digest SHA-256 do nonce. Confirmar commit. Entregar nonce uma única vez por canal autenticado. Se a resposta da emissão for perdida, não permitir nova emissão até cancelar/expirar com autorização independente.
3. **Coletar as duas assinaturas** sobre **a mesma conta + ID do convite + revisão/época + dois fingerprints + sequência + nonce**. Usar domínio distinto por papel. Chave pública do aprovador só do registro autenticado no banco; candidato prova posse da própria chave pública.
4. **Consumir**: iniciar transação `SERIALIZABLE`; bloquear a mesma linha `accounts` e o convite específico com `FOR UPDATE`. Validar que a conta autenticada é aquela do registro, convite PENDING dentro do prazo usando o tempo do servidor, revisão/época e sequência atuais, estado ativo/revogado, autenticador forte vigente, digest do nonce e as duas assinaturas Ed25519 verificadas contra as chaves canônicas. Qualquer desvio nega a transação.
5. **Uma única confirmação atômica**: inserir dispositivo candidato, avançar sequência do aprovador, incrementar revisão/época, consumir convite e gravar recibo de idempotência. Usar unicidade no banco e retentar erros de serialização com cuidado, rechecando toda autorização e tempo a cada tentativa. Nunca repetir um cadastro após resposta perdida.
6. **Requisições repetidas**: não conceder nova capacidade. Consultar recibo previamente confirmado **somente após autenticar a mesma conta e vincular o mesmo pedido**, sem reaproveitar uma autorização antiga como privilégio permanente.
7. **Revogar/cancelar**: bloquear a conta e os convites afetados na mesma transação, persistir tombstones, incrementar epoch/revision e invalidar sessões e provas dependentes. A perda do último aparelho não pode gerar primeiro aparelho por autoaprovação.
8. **Recuperar após falha**: se o serviço cair entre commit e resposta, apenas o recibo já confirmado permite informar o resultado. Se banco, autoridade, relógio ou auditoria mandatória estiverem indisponíveis, negar operações privilegiadas e não aceitar cache local como substituto.

### Propriedades que o DDL sozinho não entrega

- Conta realmente autenticada, token de sessão, autorização forte do titular e rate limiting por identidade.
- Controle de acesso e papéis mínimos no banco, gestão de segredos, RLS/grants revisados, auditoria imutável e retenção.
- Relógio do servidor sob política confiável e protocolo de expiração/purga que não reabra replay.
- Provisão/rotação de chave de autoridade, recibos/witnesses assinados e rollback-proof anchor independente do banco restaurável.
- Transações executadas por processos reais, testes de falha antes/depois do COMMIT, retry idempotente e concorrência entre instâncias.
- Registro seguro do primeiro aparelho, revogação cross-device, perda total de dispositivos e recuperação E2EE independente.
- Integração Keystore/biometria nativa e dispositivos Android físicos; pentest e auditoria externa.

## Validação e bloqueios

- Suite `SyntheticAccountBoundInviteProofLabTest.kt`: 15 grupos de cenários de assinatura válida, roles, conta, UUID, nonce, counter, malformações e chaves trocadas.
- Suite `SyntheticAccountInviteAuthorityLabTest.kt`: 30 cenários do simulador de autoridade, incluindo transferências de assinaturas entre contas/convites.
- `tests/security-account-bound-invite-contract.test.mjs`: requisitos estruturais para a integração JVM e garantias negativas do esquema SQL.
- **Nenhuma afirmação de sucesso de CI até que os jobs do HEAD atual sejam concluídos.**

**Gate de produção SEC-05: BLOQUEADO.** O SEC-05C melhora o contrato criptográfico do experimento, mas **não implementa** a autoridade persistente de produção.
