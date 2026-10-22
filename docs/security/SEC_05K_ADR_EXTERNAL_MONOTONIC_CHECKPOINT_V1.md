# SEC-05K | ADR: checkpoint externo imutável para a autoridade monotônica

**Status:** PROPOSTA PARA REVISÃO, não implantação. SEC-05K **BLOQUEADA PARA PRODUÇÃO**. Este documento não cria serviço, conta de nuvem, pin, chave, recibo real, APK nem permissão de recuperação.

## Decisão arquitetural provisória

O laboratório comprovou que um PostgreSQL e três JVMs assinantes podem voltar a OLD sob restore conjunto, mantendo as mesmas chaves e assinando desafios novos. Portanto, uma raiz confiável deve conservar evidência do avanço NEW **fora de todos os estados que o mesmo adversário consegue restaurar**.

A opção preferida para prototipagem futura, **sujeita a auditoria**, é composta de:

1. **Registro CAS de geração por conta** com owner autenticado, epoch, operationId, predecessor, novo kit, versão, geração e hash de ciphertext canônico; decisões concorrentes linearizáveis e recibos idempotentes.
2. **Checkpoint de avanço append-only** em armazenamento com retenção realmente travada, **sob outra administração e outro conjunto de credenciais**, associando epoch, operação, geração e hash do registro anterior. O fornecedor e a retenção mínima ainda não foram escolhidos.
3. **Monitor independente** que conserve o maior checkpoint testemunhado e compartilhe prova de inclusão/consistência. Uma assinatura de log isolada pode ocultar truncamento ou split-view; confiar somente no último ponteiro do próprio emissor é proibido.
4. **Fail-closed em toda operação sensível**: a gravação no registro CAS e o checkpoint não são atomicamente vinculados só por existirem. Até que ambos tenham confirmação consistente para **a mesma** operação, a resposta pode ser perdida ou contraditória. Não publicar SQLCipher/journal, não limpar marcador e não inventar rollback para OLD. Resposta ambígua ou monitor offline exige HOLD e reconciliação supervisionada.
5. **Cerimônia de substituição**: perda total, troca de epoch/pin e recuperação de backup exigem revisão de identidade, raiz independente e trilha de auditoria; nunca reenroll de OLD só porque todos os arquivos locais concordaram.

É necessário definir e demonstrar o **ponto de linearização** de uma implementação real; o desenho acima não oferece atomicidade automática entre o CAS, o checkpoint e o aplicativo.

## Opções, riscos e fatos a verificar

| Opção | Papel possível | Por que não basta sozinha |
|---|---|---|
| PostgreSQL, JVMs ou arquivos assinados | Rehearsal/diagnóstico | Rollback completo reproduz OLD válido |
| HSM apenas para assinatura | Proteção da chave privada | Não impede restaurar o contador externo à chave |
| S3 Object Lock em modo compliance | Candidato a versões de checkpoint com retenção | Protege versões durante retenção, mas **não impede novas versões ou delete markers**; não implementa CAS |
| S3 Object Lock em governance | Laboratório de permissões | Administrador com bypass específico pode alterar retenção/excluir versão |
| Google Cloud Storage Object Retention Lock / Bucket Lock | Candidato a retenção travada | Metadados/pontes de consulta e retenção finita continuam questões; não implementa CAS |
| Log Merkle com inclusão e consistência | Auditoria de extensão de histórico | Split-view exige observadores e compartilhamento independentes |

Referências oficiais a revalidar no teste do fornecedor:
- [AWS S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html): modo compliance bloqueia exclusão da versão protegida dentro do período; versões novas ainda são possíveis.
- [Google Cloud Storage Object Retention Lock](https://docs.cloud.google.com/storage/docs/object-lock): retenção não protege todos os metadados editáveis.
- [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html): provas de consistência/inclusão e o problema de visões inconsistentes.

**Nenhuma opção está contratada, configurada ou auditada neste projeto.** Selecionar uma plataforma é decisão futura de engenharia, custo e modelo de ameaça, e não evidência suficiente para desmarcar o gate.

## Matriz de falhas obrigatória para próximo laboratório e futuro piloto

| Evento | Resultado permitido antes de prova independente |
|---|---|
| CAS do registro NEW, checkpoint ainda OLD; ACK perdido | HOLD, consultar idempotência, jamais declarar sucesso |
| Checkpoint NEW, registro ainda OLD | HOLD, não retroceder checkpoint nem forçar commit financeiro |
| PostgreSQL local NEW, autoridade ou monitor indisponível | HOLD |
| Operação com mesmo UUID mas kit/hash divergente | DENY_COLLISION |
| Checkpoints de mesmo epoch/tamanho com hashes incompatíveis | DENY_SPLIT_VIEW |
| Checkpoint assinado e válido, porém abaixo de high-water previamente conhecido | DENY_ROLLBACK |
| Pin ou epoch reprovisionado sem cerimônia | DENY_IDENTITY |
| Retenção vencida, auditor ausente ou IAM de um só administrador para todos os armazenamentos | HOLD |
| CAS e checkpoint coincidentes apenas em fixtures | HOLD_EXTERNAL_AUTHORITY_REQUIRED, nunca VERIFIED_LIVE_CURRENT |

## Ensaio integrado JDBC / checkpoint sintético: janelas de confirmação

A matriz `SyntheticJdbcCheckpointCommitGapLabTest.kt` agora conecta **PostgreSQL real e descartável da CI** ao verificador puro `SyntheticIndependentCheckpointGateLab`. O checkpoint, a raiz Merkle, o monitor e o `high-water` continuam **apenas valores declarados pelo teste**, sem armazenamento imutável nem prova criptográfica verificável. Cada conta SQL é aleatória, não financeira.

- **Banco primeiro:** um CAS OLD→NEW é confirmado em transação SQL com recibo persistido e resposta perdida, enquanto o checkpoint declarado ainda está em OLD. O gate identifica divergência de geração/kit/hash e UUID, ou HOLD quando a testemunha não está presente. Repetir exatamente o CAS SQL não substitui a confirmação externa.
- **Checkpoint primeiro:** uma testemunha declarada NEW não força o PostgreSQL OLD a avançar automaticamente. A divergência e a ausência de prova de consistência exigem bloqueio; somente outra operação SQL explícita altera o banco de teste.
- **Concordância aparente:** depois de atualizados em sequência, registro e checkpoint podem concordar em NEW, mas continuam retornando exclusivamente `HOLD_EXTERNAL_ATTESTATION_AND_IMPLEMENTATION_REQUIRED`. O mesmo ocorre quando há suposta prova e números de recibos compatíveis.
- **Replay e visões divergentes:** retorno a OLD abaixo do maior checkpoint testemunhado, truncamento da árvore, raiz diferente no mesmo tamanho, nova época sem autorização, mesmo UUID com hash divergente, monitor offline e prova de consistência ausente são exercitados sem conceder permissão.

Este ensaio **não prova** que um checkpoint hospedado num provedor real sobreviveria à restauração total da autoridade ou que a escrita simultânea seria atômica. A política financeira mantém `HOLD_EXTERNAL_AUTHORITY_REQUIRED` mesmo quando todos os dados de teste coincidem; nenhum journal é publicado, e nenhuma operação de produção é alterada.

## Gates de saída (todos pendentes)

- [ ] Modelo de ameaça com operadores/credenciais, partições e limites de controle.
- [ ] Provedor e tenancy definidos; retenção real e segregação de IAM demonstradas.
- [ ] Pin fora de banda, rota de rotação de epoch e autorização do titular verificados.
- [ ] Protótipo de serviço e monitor **somente com contas sintéticas**; provas de inclusão, consistência e high-water independentes.
- [ ] Injeção de perda de energia, ACK perdido, CAS concorrente, split-view, retomada e replays pós-restore.
- [ ] Teste de restauração coordenada de todos os backups principais e, separadamente, tentativa de restore/eliminação do próprio checkpoint.
- [ ] Revisão independente dos argumentos de segurança e plano de recuperação de desastre.
- [ ] Somente depois disso: avaliação de integração Android/SQLCipher real e gate de release.

**PR #14 permanece draft, sem merge/release/APK. PR #17 das IAs não deve ser modificada.** Este ADR não autoriza alterar o estado financeiro ou recuperar dados de clientes.


## SEC-05K | Verificação criptográfica de inclusão Merkle (somente laboratório)

O arquivo SyntheticMerkleInclusionProofLabTest.kt implementa, **somente em JVM de teste**, a checagem computacional de uma prova de **inclusão de uma folha em uma raiz de árvore especificada**. Usa SHA-256 com os prefixos 0x00 para folhas e 0x01 para nós, divisão à esquerda segundo a árvore de RFC 9162 e comparação constante de digest. Inclui uma raiz de três folhas precalculada independentemente, percursos para árvores de 1 a 13 folhas e rejeição de índice inválido, caminho truncado/excedente, tamanhos incorretos, nó adulterado, folha diferente e raiz diferente. A implementação limita tamanhos e comprimento do caminho para evitar entrada excessiva.

**Escopo negativo indispensável:** se a **própria raiz** vier do emissor não confiável, ele pode inventar a árvore e produzir uma prova de inclusão válida para um evento falso. O ensaio demonstra isso expressamente. Mesmo uma inclusão verdadeira **não garante que a raiz foi autenticada, que a árvore é extensão append-only da versão anterior, que o registro mais recente está nela, que dois leitores recebem a mesma visão, que houve retenção imutável real nem que o titular autorizou uma transação**. Provas de consistência de duas raízes, assinaturas de tree heads e raízes pinadas por monitor independente **não são implementadas** nesta rodada.

O resultado criptográfico positivo continua limitado ao laboratório. A política de reconciliação mantém HOLD_EXTERNAL_AUTHORITY_REQUIRED; nenhuma afirmação é promovida a VERIFIED_LIVE_CURRENT, nenhum jornal ou banco financeiro do aplicativo é modificado. CI: policyCheck JVM e contrato Node dedicado. **PR #14 draft, SEC-05K BLOQUEADA PARA PRODUÇÃO.**
