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

### Reforço com processos JVM independentes

O verificador `NativeLockCoordinatorTestKt` inclui o modo isolado `--sec05k-recover-fixture-only <pasta-temporaria>`, que **não recebe segredo, DEK, plaintext nem autorização** na linha de comando. O teste inicia um novo processo `java` com `ProcessBuilder` e confere a recuperação no diretório descartável com **heap e identificador de processo diferentes**. São exercitados:

1. Reinício limpo e candidato órfão ainda sem journal;
2. `PREPARED` retornando à geração antiga, com repetição permitida;
3. `COMMITTED` concluindo a nova geração, inclusive pós-`active.snapshot` substituído e segundo reinício;
4. Arquivo candidato comprometido após `COMMITTED` e journal alterado, ambos **fail closed**;
5. Bloqueio `FileLock` detido por outro processo, com `DENY_BUSY`, liberando o acesso somente após saída do lock;
6. Teste estático Node impedindo que os segredos sintéticos sejam repassados ao processo filho.

Esses testes diferenciam **nova instância JVM** de **novo processo JVM**, que anteriormente não havia sido exercitado. Ainda não equivalem a matar fisicamente o processo com `SIGKILL` ou cortar energia; o sistema operacional e seu filesystem podem ter comportamento de persistência diferente.

**Atenção:** injeção de crash por ponto de parada **não equivale** a teste de energia cortada ou falha de armazenamento físico. Sincronização de diretório e rename atômico dependem das garantias efetivas do sistema operacional e filesystem; é necessário verificar em hardware e sistemas de arquivos suportados.

## Rehearsal adicional: encerramento abrupto da JVM e exportação destacada

O reforço `SEC-05K` exercita agora um **processo Java filho que executa `commitFixtureOnly` e termina abruptamente via `Runtime.halt(73)`** depois de dois pontos de checkpoint possíveis: persistência do journal `COMMITTED`, ou substituição/sincronização do arquivo ativo. Um **terceiro processo** (outra JVM) retoma a migração. Esse teste verifica independência de heap e estado do processo anterior; o código de saída 73 comprova que o encerramento foi intencional no fixture, não resultado de falha genérica.

O segredo sintético de 32 bytes é transmitido ao processo filho por **stdin**, e não via linha de comando, ambiente ou log. O processo zera sua cópia antes do encerramento. O envelope cifrado portátil é exportado em **outro diretório descartável**, com escrita + fsync do arquivo; o processo filho lê essa cópia e recusa completar o commit se o segredo estiver incorreto ou o envelope tiver sido adulterado.

A exportação separada é **somente uma simulação de backup independente**: diretórios distintos no mesmo host **não comprovam mídia externa**, controle efetivo do usuário, durabilidade após incêndio/perda do aparelho nem retenção do segredo fora da RAM. O laboratório ainda não possui uma cerimônia de backup com confirmação externa confiável e não cria essa garantia apenas por concluir o teste.

**Limites importantes:** o `Runtime.halt` ocorre **imediatamente depois** de a função de teste retornar no checkpoint de falha injetada; ele não mata a JVM no meio de uma chamada de filesystem, não interrompe uma `fsync` em andamento, não representa falha de energia e não demonstra comportamento em um dispositivo Android físico. O teste verifica uma janela concreta de queda de processo com dados sintéticos, mas **não libera o gate de produção**.

## Nova prova SEC-05K: abertura via kit destacado após reiniciar

O método `verifyDetachedBackupAfterRestartFixtureOnly` **não grava nem migra dados**. Exige que `active.snapshot` esteja consistente, que não haja journal ou candidato pendente e que o chamador indique explicitamente **conta, kit, versão e geração esperados**. Um envelope cifrado **fornecido à parte** precisa coincidir byte a byte com o envelope da geração ativa. Com um **segredo sintético de 256 bits** fornecido separadamente, o método tenta recuperar a DEK e descriptografar **todos os registros AES-GCM do snapshot atual**. Ele apaga as cópias temporárias de DEK e plaintext e retorna somente `VERIFIED_DETACHED_BACKUP_FIXTURE_ONLY`, sem devolver registros ou materiais secretos.

O runner JVM oferece `--sec05k-verify-detached-fixture-only` para execução **em outro processo Java independente**: caminho para o snapshot de laboratório, metadados não secretos e caminho de envelope aparecem em argumentos; o segredo é transmitido exclusivamente por **stdin** e apagado da cópia local quando a operação termina. Entradas curtas são rejeitadas como prova inválida.

**Matriz de regressão:** reinício depois de `Runtime.halt(73)` no commit, recuperação concluída em JVM independente, e então verificação de todos os registros em **terceira JVM**. Casos negativos testam segredo errado/curto, identificação de conta/kit errada, geração obsoleta, tentativa de validar candidato ainda `PREPARED`, exportação cifrada adulterada e snapshot ativo corrompido, com recusa determinística e sem publicação de dados incorretos.

**Limite crítico:** esta prova demonstra que o envelope e o segredo **fornecidos no teste** continuam capazes de abrir a geração atual. **Não comprova que o usuário salvou a frase/segredo fora do aparelho, nem que possui uma mídia externa íntegra**. O segredo é passado na memória temporária do cenário; não existe cerimônia real de confirmação de cópia, restauração física em outro dispositivo, SQLCipher integrado ou autorização de pessoa. O checksum e a igualdade de snapshots não implementam anti-rollback contra atacante ativo. Portanto, o gate de backup externo e o gate de produção permanecem **BLOQUEADOS**.

## Reforço do filesystem: impedir redirecionamento via symlink

O journal sintético não deve aceitar arquivos indiretos ou `dangling symlinks` como `active.snapshot`, `pending.snapshot`, `migration.journal`, `migration.lock` ou como diretório raiz do fixture. O laboratório agora aplica `LinkOption.NOFOLLOW_LINKS` em verificações de presença/tipo e na abertura do arquivo de lock, além de rejeitar caminhos reservados que sejam links simbólicos **antes da operação**.

A matriz da SEC-05K cobre aliases para snapshots válidos fora do diretório, candidatos em `PREPARED`, links para journal, lock externo e diretório raiz redirecionado, incluindo pendência de link sem destino. Espera-se `FAIL_CLOSED`, preservação dos alvos externos e retomada segura somente depois de remover o alias. Isso inclui reinício com uma segunda JVM.

**Limites:** é um reforço local que demonstra rejeição de aliases no **fixture**. Não é uma solução completa para symlink races/TOCTOU entre validação e uso, hardlinks, montagens de diretório, permissões inseguras de diretórios ascendentes ou processo hostil com acesso de escrita à pasta. Implementação real exige diretório privado com permissões restritas, operações atômicas seguras para o sistema operacional alvo, auditoria e testes de hardware. Nenhum desses controles é aprovado no APK.

## Reforço de concorrência: leitura pelo descriptor e verificação pós-publicação

O laboratório SEC-05K troca a leitura baseada em `Files.readAllBytes(path)` por `FileChannel.open(path, READ, NOFOLLOW_LINKS)`, mantém o **mesmo descriptor aberto** ao conferir tamanho e ler os bytes e recusa arquivo truncado, leitura sem progresso ou tamanho alterado durante a operação. Isso reduz a janela específica de troca de symlink **entre a inspeção de caminho e a abertura do arquivo**, além de limitar leituras a 128 KiB.

A etapa de commit já escreve `COMMITTED` de forma síncrona **antes** de mover o candidato. Agora também revalida o hash do candidato após o marker e, **depois do rename e do fsync do diretório**, relê o `active.snapshot` para comparar seu hash com o `newHash` do journal **antes de apagar o marcador**. A retomada `COMMITTED` faz a mesma revalidação prévia e posterior à publicação quando precisa mover um candidato. Se o conteúdo publicado não corresponder, retorna `FAIL_CLOSED` e **preserva o marcador COMMITTED para diagnóstico**, em vez de relatar sucesso.

Foram adicionadas duas corrupções intencionais, exclusivas do laboratório: `TAMPER_PENDING_BEFORE_PUBLISH_FIXTURE_ONLY` altera o candidato depois de sincronizar `COMMITTED`; `TAMPER_ACTIVE_AFTER_PUBLISH_FIXTURE_ONLY` altera a cópia ativa depois da substituição mas antes da verificação pós-publicação. Os testes precisam recusar ambas sem apagar o marcador, sem retorno de autorização financeira e sem rollback silencioso. Um commit normal continua verificável e limpa o journal.

**Limites explícitos:** duas leituras de checksum **não fornecem exclusão mútua contra processos hostis que ignoram o lock**, nem impedem substituição posterior ao último check, arquivo hardlinkado, diretorios pais controlados por atacante, TOCTOU em operações de rename/remove, corrupção de energia ou adulteração com SHA-256 recalculado. A proteção de produção dependerá de diretório privado, primitivas do SO, credenciais/geração monotônica autenticadas e revisão da arquitetura nativa. Não confundir este teste com solução completa para concorrência ou prevenção de tamper.

## Ensaio adicional: escritor não cooperativo (independente do FileLock)

O `FileLock` protege **escritores cooperativos** no laboratório, mas não deve ser confundido com proteção contra outro processo que ignore o bloqueio. Para deixar esse risco explícito, foi acrescentado o modo de teste de JVM `--sec05k-noncooperative-candidate-fixture-only`, **restrito aos diretórios temporários descartáveis** `negresco-sec05k-disposable-*`. O processo pai segura `migration.lock` enquanto o processo filho modifica o primeiro byte de `pending.snapshot`, sem adquirir o lock, sincronizando a alteração.

Casos previstos:
- Alteração por outra JVM enquanto existe `PREPARED`: o commit recusa o candidato inconsistente (`FAIL_CLOSED`) e uma nova JVM pode descartar o candidato ao reverter `PREPARED`, mantendo a geração antiga. Depois da limpeza, uma nova preparação íntegra continua permitida.
- Alteração por outra JVM **depois** de `COMMITTED`: a recuperação **não volta silenciosamente** para a geração antiga, retorna `FAIL_CLOSED` e preserva o journal para reparo sob política segura.
- Janela determinística `TAMPER_PENDING_AFTER_FINAL_CHECK_FIXTURE_ONLY`: corrupção é injetada **após a última comparação do candidato e imediatamente antes do rename**. A verificação pós-publicação detecta que o novo snapshot não corresponde ao `newHash`, retorna `FAIL_CLOSED` e não elimina o journal.

**Esse ensaio não impede o ataque; mede e registra a contenção de dano em janelas específicas.** Uma alteração concorrente pode manter os dados indisponíveis, e os hashes SHA-256 locais não autenticam a autoria da mudança. Proteção efetiva ainda requer isolamento de armazenamento por permissões do SO, controle de identidade, resistência a substituição de diretórios e proteção externa de geração monotônica. É proibido interpretar `FAIL_CLOSED` como `BACKUP_RECUPERADO` ou `PRONTO_PARA_PRODUCAO`.

## Reinicialização negada e matriz de falhas de armazenamento

**Risco demonstrado:** no fixture anterior, a ausência isolada de `active.snapshot` e de um journal podia parecer um diretório inicial vazio e permitir que `seedFixtureOnly` aceitasse uma identidade/geração nova. O reforço inclui `provisioned.guard`, um marcador local, sincronizado e de conteúdo estático, escrito **antes** de publicar o primeiro snapshot. Um novo `seed` não sobrescreve este marcador. Se o arquivo ativo sumir mas o marcador sobreviver, a recuperação responde `FAIL_CLOSED` e uma tentativa de re-provisionamento recebe `DENY_INVALID_OR_STALE`.

O marcador é verificado em cada operação com um checksum de conteúdo fixo; marcador danificado, ausente em diretório que ainda contém snapshot/journal ou representado por link simbólico deve resultar em recusa, sem criação automática de novos registros. Se a gravação do marcador ocorrer mas a gravação inicial do snapshot falhar, o fixture **fica bloqueado para re-provisionamento automático** e exige tratamento manual em ambiente descartável.

A nova matriz testa arquivos com **zero byte**, com **36 bytes** (abaixo do mínimo de envelope validável) e com **131073 bytes** (acima do limite de 128 KiB):
- Snapshot ativo inválido: `FAIL_CLOSED` no reinício e na tentativa de migração; após restauração *manual do mesmo ciphertext sintético*, recuperação pode ser repetida.
- Candidato ainda `PREPARED`: conteúdo inválido é descartável, e a recuperação pode reverter ao snapshot antigo validado.
- Candidato **COMMITTED** truncado, grande demais ou ausente: `FAIL_CLOSED` e journal preservado; restauração do candidato criptografado correspondente ao commit permite finalizar a nova geração sem rollback silencioso.
- Journal truncado/grande demais: `FAIL_CLOSED` sem descartar candidato; restaurar o journal correto reabre a via de recuperação.
- Marcador de provisionamento adulterado ou ausente: bloqueio do acesso normal e da inicialização que poderia sobrescrever dados históricos.

**Atenção:** o marcador `provisioned.guard` serve somente para reconhecer um diretório de teste previamente inicializado em falhas **parciais**. Não é autenticado por uma chave externa, não impede remoção simultânea de marcador+snapshot por atacante ou perda total da mídia e **não é uma fonte monotônica externa de geração**. Não equivale a uma garantia de backup, autenticação do titular, recuperação de SQLCipher nem prontidão para produção. As restaurações efetuadas nos testes usam cópias sintéticas preparadas pelo próprio laboratório; não representam uma recuperação real de dispositivo perdido.

## Faltam antes de produção

- **Backup externo real confirmado:** o parâmetro de envelope+segredo verifica criptografia, mas **não demonstra que o usuário salvou o segredo fora do dispositivo**. Queda após a decisão de commit pode tornar os dados inacessíveis se o único segredo ficou na memória do processo. Deve existir cerimônia de backup externo com prova segura, persistente e independente **antes** do commit, sem guardar o segredo em claro.
- Transação nativa entre banco cifrado, catálogo de gerações e credenciais recuperáveis. O journal aqui só cobre o arquivo sintético, não o SQLCipher.
- Autenticação forte do titular e controles de permissão/consentimento, serviços de autoridade, auditoria, múltiplos dispositivos, regras de revogação e concorrência entre hosts.
- Proteção autenticada contra rollback/tamper, estado monotônico externo e cadeia de custódia de backups; o checksum não protege contra um adversário ativo.
- Garantias formais sobre torn writes, falta de espaço, corrupção no próprio journal, sincronização física, crash de energia, backups remotos e restauração remota.
- Nenhuma versão atual garante apagar backups antigos copiados por um invasor. Uma DEK comprometida continua descriptografando ciphertext históricos preservados offline.

**Resultado permitido:** demonstração limitada e verificável de recuperação de processo para a fixture. **Resultado proibido:** afirmar que a SEC-05K concluiu o sistema de recuperação real ou aprovou lançamento.
