# SEC-05K | Journal durável para migração de chave interrompida

**Data:** 21/10/2026  
**Escopo:** continuação da SEC-05J; laboratório JVM descartável em `tooling/native-lock-spike`.  
**Gate de produção:** **BLOQUEADO**. PR #14 continua em rascunho; sem APK, merge, titular autenticado, backend ou dados financeiros reais.

> **NÃO É MIGRAÇÃO DE CRIPTOGRAFIA EM PRODUÇÃO.** O mecanismo trabalha com registros sintéticos já cifrados pela SEC-05J e arquivos temporários isolados. Não migra SQLCipher real, não integra bancos, não provisiona aparelhos, não autentica titular e não autoriza transações financeiras.

## Problema real que esta etapa simula

A SEC-05J só publicava uma nova DEK e ciphertext de forma atômica **na memória de uma JVM**. Quedas de processo entre a gravação da chave nova, o envelope de recuperação e os registros poderiam deixar um conjunto incompleto e potencialmente inacessível.

A SEC-05K acrescenta um **journal de duas fases** para um conjunto cifrado descartável. Não persiste a DEK, o segredo do kit, a senha de login nem o plaintext. Persiste **apenas** metadados mínimos, registros AES-GCM cifrados e envelopes de recuperação portáteis (que não contêm o segredo separado).

## Arquivos de simulação e fronteiras

- `active.snapshot`: fotografia completa e cifrada da geração ativa.
- `pending.snapshot`: fotografia da geração candidata, antes de publicação.
- `migration.journal`: decisão `PREPARED` ou `COMMITTED`, identidade opaca da conta, IDs de kit anterior e posterior e digests dos dois snapshots.
- `migration.lock`: exclusão mútua de escritores entre processos no sistema de arquivos.

O formato binário usa versão, limites de tamanho, ordem canônica para registros e aposentadorias, leitura integral e SHA-256 para detectar **corrupção acidental**. **SHA-256 NÃO é assinatura nem MAC**: quem consegue reescrever os arquivos pode recalcular um digest. Por isso esta etapa não fornece proteção contra invasor com escrita no diretório, rollback malicioso, replay de geração ou autoridade criptográfica online.

Os dados cifrados individuais usam AAD com conta, registro, versão e geração, conforme SEC-05J. `prepareFixtureOnly` recupera temporariamente DEKs antigas e novas usando **segredos fornecidos separadamente**, descriptografa as duas cópias e exige igualdade byte a byte dos dados de teste. Faz limpeza best-effort das cópias de chaves e plaintext em memória.

## Protocolo de interrupção

1. **Seed:** somente um estado inicial pode ser provisionado; nenhuma segunda chamada substitui o estado ativo.
2. **Prepare:** sob lock, exige conta e kit atuais e geração exatamente +1; compara AAD, plaintext e DEKs diferentes. Escreve `pending.snapshot` e sincroniza o arquivo e diretório. Só então escreve o journal `PREPARED`, com fsync.
3. **Sem commit:** na reinicialização, descarta `pending.snapshot`, preserva `active.snapshot` e remove o journal. Um candidato sem journal também é descartado. A operação pode ser refeita.
4. **Commit:** exige envelope portátil externo idêntico e segredo de recuperação separado; verifica a recuperação da nova DEK e todos os registros cifrados. Escreve o journal `COMMITTED` **antes** de substituir o estado ativo; move `pending.snapshot` para `active.snapshot` com rename atômico no mesmo volume e fsync do diretório.
5. **Pós-commit interrompido:** uma nova instância lê `COMMITTED` e sempre completa a publicação da nova geração, mesmo que o processo original tenha parado antes ou depois do rename. A recuperação repetida é idempotente.
6. **Divergência:** se `COMMITTED` não tem nem um estado ativo novo válido nem um candidato íntegro para finalizar, **falha fechada**. É proibido restaurar silenciosamente o estado antigo após a decisão durável de commit.

**Ponto de linearização:** persistência sincronizada do journal `COMMITTED`. O resultado bem-sucedido do método depende ainda da publicação e limpeza do journal. Falhas de IO, renomeação atômica ou fsync recusam sucesso.

## Testes e injeção de queda

O laboratório contém cenários de queda **após sync do candidato, após PREPARED, após COMMITTED e após substituição ativa**, com simulação de reinício por criação de nova instância. Inclui segredo errado, conta/kit obsoletos, alteração de ciphertext AES-GCM, alteração de arquivos do journal/estado, recusa de replay, nenhuma publicação parcial e corrida de dois escritores com `FileLock`. Os testes são conectados ao `policyCheck` JVM e há contrato Node para impedir importação pelo aplicativo Expo.

**Atenção:** injeção de crash por ponto de parada **não equivale** a teste de energia cortada ou falha de armazenamento físico. Sincronização de diretório e rename atômico dependem das garantias efetivas do sistema operacional e filesystem; é necessário verificar em hardware e sistemas de arquivos suportados.

## Faltam antes de produção

- **Backup externo real confirmado:** o parâmetro de envelope+segredo verifica criptografia, mas **não demonstra que o usuário salvou o segredo fora do dispositivo**. Queda após a decisão de commit pode tornar os dados inacessíveis se o único segredo ficou na memória do processo. Deve existir cerimônia de backup externo com prova segura, persistente e independente **antes** do commit, sem guardar o segredo em claro.
- Transação nativa entre banco cifrado, catálogo de gerações e credenciais recuperáveis. O journal aqui só cobre o arquivo sintético, não o SQLCipher.
- Autenticação forte do titular e controles de permissão/consentimento, serviços de autoridade, auditoria, múltiplos dispositivos, regras de revogação e concorrência entre hosts.
- Proteção autenticada contra rollback/tamper, estado monotônico externo e cadeia de custódia de backups; o checksum não protege contra um adversário ativo.
- Garantias formais sobre torn writes, falta de espaço, corrupção no próprio journal, sincronização física, crash de energia, backups remotos e restauração remota.
- Nenhuma versão atual garante apagar backups antigos copiados por um invasor. Uma DEK comprometida continua descriptografando ciphertext históricos preservados offline.

**Resultado permitido:** demonstração limitada e verificável de recuperação de processo para a fixture. **Resultado proibido:** afirmar que a SEC-05K concluiu o sistema de recuperação real ou aprovou lançamento.
