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

## Teste adicional: testemunha de geração com HMAC em diretório destacado

A SEC-05K ganhou o módulo **`SyntheticDetachedGenerationWitnessLab`**. É uma prova exclusivamente **JVM, sintética e opcional** de vínculo entre um snapshot cifrado e um recibo de geração mantido em outra pasta descartável. A testemunha armazena apenas conta opaca, ID do kit, versão, geração e SHA-256 dos bytes completos do snapshot, todos autenticados com um **HMAC-SHA-256** que inclui domínio criptográfico próprio. A chave secreta de 32 bytes é entregue na memória ao laboratório; **não é escrita no recibo, journal, APK nem usada como chave financeira**.

**Operações distintas:**
- `bootstrapFixtureOnly`: cadastro inicial **explícito**, somente quando a testemunha ainda não existe. Não ocorre automaticamente ao validar o snapshot.
- `advanceFixtureOnly`: atualiza um recibo autenticado, verificando o snapshot **anterior exato**, mesma conta, kit renovado e avanço estrito de **uma** versão e **uma** geração. Grava em arquivo temporário, sincroniza, renomeia atomicamente e sincroniza o diretório.
- `verifyFixtureOnly`: compara a identidade, geração e hash da cópia cifrada informada com o recibo assinado. Retorna status, **sem decriptar dados ou conceder acesso**. Testa recusa de assinatura inválida, estado local antigo, falta da testemunha, chave errada, caminho via symlink e localização da testemunha dentro da própria pasta do journal.

**Falha importante detectada:** se `active.snapshot` e `provisioned.guard` forem apagados juntos, o guard local não impede sozinho que um diretório pareça virgem. Depois de uma **recriação sintética** da geração local, a testemunha destacada **ainda existente e não adulterada** rejeita o novo estado. Uma cópia velha de `active.snapshot` também falha quando comparada com um recibo atualizado que o atacante não substituiu.

**Limitações fundamentais demonstradas por teste negativo:** HMAC prova autenticidade dos bytes do recibo, **não irreversibilidade nem avanço monotônico verdadeiro**. Se alguém puder restaurar tanto uma versão antiga do snapshot quanto um **recibo antigo validamente assinado**, o par volta a verificar **mesmo sem conhecer a chave HMAC**. O teste registra explicitamente esse ataque de *replay de par assinado*. Como o witness está apenas em **outra pasta do mesmo host** e o teste fornece a chave em memória, não existe uma autoridade independente real, contador seguro, servidor, HSM, comprovação de backup fora do dispositivo, nem autorização do titular.

Outro limite: este módulo **não é integrado como policy gate das transações** do journal, não faz CAS com servidor nem autentica uma decisão `COMMITTED` que permaneceu pendente. Entre `COMMITTED` e atualização do witness existe uma janela operacional que requer protocolo de reconciliação, idempotência e tratamento de falhas de rede antes de qualquer uso real. O laboratório não tem proteção contra escritor concorrente no diretório da testemunha nem substituição de pasta ancestral.

**Gate de produção:** permanece BLOQUEADO até existir uma âncora de geração genuinamente independente, autenticada e monotônica, protocolo pós-crash/commit consistente, autorização real de usuário, armazenamento Android isolado/SQLCipher integrado, backup durável verificável e testes físicos de queda de energia. Não tratar este componente como solução final de rollback ou recuperação de backup.

## Política de reconciliação: autoridade atual versus journal local

A SEC-05K agora contém `SyntheticJournalAuthorityReconciliationPolicyLab`, **um decisor puro sem efeitos colaterais**, para examinar conflitos entre o journal local e uma autoridade de geração **verdadeiramente atual**. O código **não** consulta um servidor, autentica uma chave de autoridade, aplica o journal, sincroniza o banco, libera acesso financeiro ou grava contadores. Apenas retorna estados tipados de **ação permitida para análise futura** ou **bloqueio**. A suíte independente `SyntheticJournalAuthorityReconciliationPolicyLabTest` percorre combinações de fase, snapshot, candidato e geração da autoridade, incluindo formatos inválidos.

**Pré-condição obrigatória:** `VERIFIED_LIVE_CURRENT` representa *somente* uma resposta criptograficamente autenticada, com frescor comprovado e chave de confiança fixada por um verificador **que ainda não foi construído** para a geração do journal. O recibo HMAC destacado atual é explicitamente classificado `REPLAYABLE_DETACHED_HMAC_ONLY` e sempre leva a `HOLD_EXTERNAL_AUTHORITY_REQUIRED`; assim ele nunca se transforma automaticamente em autoridade monotônica.

**Matriz conservadora planejada:**

| Journal | Snapshot ativo | Autoridade comprovadamente atual | Resultado sem efeitos colaterais |
| --- | --- | --- | --- |
| CLEAN | Mesmo snapshot autenticado | Mesma geração | `VERIFIED_STABLE_READ_ONLY` |
| PREPARED | Geração antiga autenticada | Geração antiga | `MAY_DISCARD_PREPARED_CANDIDATE_ONLY` |
| COMMITTED | Antigo, candidato novo autenticado disponível | Geração nova | `MAY_FINALIZE_COMMITTED_NEW_SNAPSHOT_ONLY` |
| COMMITTED | Novo autenticado já publicado | Geração nova | `MAY_CLEAR_COMMITTED_MARKER_ONLY` |
| COMMITTED | Antigo ou novo | Geração antiga | `HOLD_EXTERNAL_AUTHORITY_REQUIRED` (sem avançar autoridade a partir de journal local) |
| CLEAN | Antigo | Geração nova | `DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED` |
| CLEAN | Novo | Geração antiga | `DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED` |
| Qualquer fase | Snapshot/candidato não reconhecido, journal corrompido | Qualquer | `DENY_CORRUPT_OR_INCONSISTENT` |
| Qualquer fase | Qualquer | Offline, HMAC replayável, assinatura inválida | `HOLD_EXTERNAL_AUTHORITY_REQUIRED` |

Os estados `MAY_*` **NÃO são permissões operacionais**: um motor de reconciliação futuro precisa verificar a identidade real do titular, account/kit/versão, origem e desafio fresco de uma autoridade fora do dispositivo, integridade de snapshots e journal, operações atômicas e rechecagem depois de qualquer I/O. O critério de sequência só autoriza avanços unitários válidos, sem overflow. Em caso de rede offline, recibo replayável, assinatura inválida ou divergência indecidível, bloquear é preferível a reverter `COMMITTED` ou inventar confirmação de atualização.

**Riscos ainda abertos:** não há autoridade independente implantada, contador remoto realmente monotônico, assinaturas de geração ligadas ao snapshot com prova de frescor, banco SQLCipher integrado, compensação quando a autoridade avançou mas o arquivo não foi publicado, idempotência interprocesso/interdevice, autenticação do titular ou backup externo verdadeiro. Os resultados deste arquivo permanecem **LABORATÓRIO / NÃO PRODUÇÃO**.

## Ensaio assinado Ed25519: desafio de uso único vinculado à geração

O componente JVM `SyntheticSignedRekeyAuthorityChallengeLab` acrescenta verificação **criptográfica** de resposta Ed25519 sobre um payload binário canônico com *domain separation*, conta opaca, ID do kit, versão, geração, SHA-256 do snapshot cifrado e desafio aleatório de **32 bytes** gerado pelo cliente de teste. Um `SyntheticSignedRekeyChallengeSessionLab` consome cada desafio na primeira tentativa de verificação, mesmo inválida; uma segunda tentativa no mesmo objeto é recusada. A chave pública de verificação é **fornecida de forma independente pelo teste** e é validada estritamente como Ed25519 usando o validador RFC 8410 já existente.

O ensaio cobre assinatura válida sob a chave pinada, desafio trocado, repetição da assinatura anterior com desafio novo, assinatura alterada, chave alheia, algoritmo EC/P-256, assinatura ausente/curta, afirmação vazia/malformada, conta incorreta, kit alheio, versão desatualizada, geração diferente e hash cifrado alterado. Não há chave privada persistida, dados bancários ou serviços externos envolvidos.

**NÃO é autoridade online implantada.** Mesmo com assinatura válida, o resultado da verificação é deliberadamente `VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY`; a política de reconciliação o classifica como `SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY` e responde `HOLD_EXTERNAL_AUTHORITY_REQUIRED`. Uma assinatura sobre um nonce **não comprova por si só que um emissor está conectado a um contador monotônico independente**, que sua chave foi provisionada de forma confiável ou que a resposta veio de um servidor com estado transacional atualizado. O desafio é consumido apenas em memória JVM: não existe gerenciamento durável de nonce, canal de comunicação, tempo de expiração auditável nem proteção contra outro processo com acesso privilegiado.

**Próximos gates:** autoridade realmente independente com geração monotônica por conta, pinning de chave distribuído com segurança, desafio fresco com nonce persistido, vinculação ao commit/journal exato, atomicidade da atualização remota, reconciliação de timeout e testes entre dispositivos. Não conectar esse ensaio ao APK nem convertê-lo em autorização financeira.

## Ensaio adicional: CAS monotônico sintético, resposta perdida e idempotência

O laboratório JVM inclui agora `SyntheticRekeyAuthorityCasTimeoutLab.kt` e `SyntheticRekeyAuthorityCasTimeoutLabTest.kt`. É uma **autoridade falsa totalmente em memória**, isolada no módulo `tooling/native-lock-spike`, cuja função é testar a lógica de *compare-and-swap* (CAS) de geração e a **perda da resposta após o CAS ter sido aplicado**.

O estado registra a geração cifrada atual por conta de teste, com chave de operação `UUID` para idempotência. O CAS só aceita o snapshot anterior **exato** (conta, kit, versão, geração e hash), novo kit, avanço unitário de versão e geração e op-id sem conflito. Dentro de um único monitor JVM, CAS concorrentes com o mesmo estado anterior não podem ambos vencer. Um simulador opcional aplica a nova geração e **descarta a resposta** (`null`), reproduzindo a dúvida do cliente após timeout. Tentar novamente com o **mesmo op-id e mesmo payload** responde que essa operação já foi aplicada **somente se a geração ainda for a atual**, sem avançá-la duas vezes; op-id com payload diferente é recusado; tentativa com novo op-id e predecessor antigo também é recusada. Depois de avanço posterior, confirmação antiga não equivale a estado atualizado.

A leitura do estado da autoridade falsa pode ser assinada com a chave Ed25519 **gerada no teste** e vinculada a um desafio novo de 32 bytes pelo verificador existente. Isso demonstra o fluxo `timeout -> consulta com desafio novo -> confronto da geração/hash -> idempotência`. Entretanto, a resposta só alcança `VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY`; a política continua retornando `HOLD_EXTERNAL_AUTHORITY_REQUIRED`. **Não** libera `MAY_FINALIZE`, publicação de snapshot, movimentação financeira ou recuperação real.

Os testes também abrangem conta desconhecida, provisionamento duplicado, kit não renovado, salto de geração, hash anterior diferente, tentativa de migração entre contas, overflow de contadores, leitura com desafio inválido, assinatura de estado antigo que não satisfaz a geração esperada e duas chamadas simultâneas tentando avançar a mesma geração.

**Riscos que não foram resolvidos:** esse estado fica **inteiramente em RAM** e desaparece no reinício; não é uma autoridade monotônica durável, não suporta rede, falha de processo do servidor, consenso, múltiplos nós, CAS transacional em PostgreSQL, idempotência durável após timeout, identidade do titular, pinning seguro em Android ou restauração off-device. O processo que assina as respostas não representa um emissor independente confiável. Por isso o teste de CAS **não muda a aprovação de produção**. O próximo gate real exige persistência transacional, garantia de atomicidade entre geração e op-id, leitura remota autenticada com frescor, janela de timeout comprovável e reconciliação segura com journal SQLCipher.

## SEC-05K: persistência transacional de geração e idempotência no PostgreSQL de teste

**Novo ensaio executável no CI:** `004_sec05k_cas_persistence_lab.sql` cria duas tabelas exclusivas de teste no esquema `negresco_sec05k_cas_lab`, sem alterar contas, operações bancárias ou a base SQLCipher real. A tabela `generations` contém identificador de conta de teste, kit, versão/geração e hash dos bytes de ciphertext. A tabela `operation_receipts` contém um identificador único de operação e vínculos explícitos ao estado anterior/posterior. **Nenhuma DEK, segredo de recuperação, credencial bancária ou conteúdo financeiro aparece nas tabelas.**

O teste `SyntheticJdbcRekeyCasPersistenceLabTest.kt` abre conexões JDBC independentes, bloqueia a linha da conta com `SELECT ... FOR UPDATE`, compara todos os campos da geração anterior e, numa única transação PostgreSQL, atualiza `generations` e insere o recibo de idempotência. Um aborto injetado **após as escritas e antes do COMMIT** precisa reverter **ambas**; a simulação de resposta perdida **após COMMIT** precisa manter ambos persistidos. A verificação do **mesmo UUID e payload** retorna `ALREADY_APPLIED_CURRENT_FIXTURE_ONLY` sem avançar novamente, enquanto reutilizar o UUID com payload diferente gera colisão recusada.

Além de consultas por conexões independentes, uma **segunda JVM** abre a base com um novo processo e verifica que a geração e o recibo sobrevivem à perda do heap do processo inicial, e que a repetição do mesmo UUID/payload continua idempotente. O teste também disputa oito conexões simultâneas usando a mesma geração anterior: somente uma pode avançá-la e gravar recibo. Uma geração seguinte válida torna um recibo antigo histórico, não uma prova do estado atual.

A CI executa a migração **apenas no container PostgreSQL descartável** do trabalho `authority-postgres-lab`, seguida dos comandos Gradle `pgBoundProofCheck pgRekeyCasCheck`. O SQL é DDL de ensaio e não existe plano de implantação automática. Este ensaio de integridade não substitui auditoria, backup, autenticação e políticas de acesso.

**Limitações críticas:** persistência no PostgreSQL de CI não é autoridade externa independente de verdade; não existe implantação, autenticação do titular, chave de assinatura protegida, distribuição de confiança, TLS, transação entre PostgreSQL e SQLCipher local, retenção de histórico frente a restore de backup antigo do servidor, replicação, quorum, falha física, cadeia de auditoria imutável ou prova de resposta *fresh/live*. Uma transação aplicada remotamente mas não publicada localmente **ainda requer reconciliação com journal sob protocolo autenticado**; não liberar produção por passar este teste.

## SEC-05K: inspeção cruzada, SEM efeitos colaterais, do PostgreSQL e do journal

O laboratório adiciona `observeAgainstCasFixtureOnly` a `SyntheticDurableRekeyJournalLab` e executa `SyntheticJdbcJournalAuthorityDivergenceLabTest.kt` dentro de `pgRekeyCasCheck` no PostgreSQL descartável da CI. O observador obtém o lock consultivo do fixture para evitar conflito com gravadores **cooperativos**, abre arquivos criptografados sem seguir symlink, verifica os frames e campos da identidade, e compara o SHA-256 dos bytes reais com as afirmações *antes/depois* registradas no recibo PostgreSQL. Ele analisa o marcador `PREPARED/COMMITTED` e seus hashes sem invocar `recoverFixtureOnly`, sem publicar o candidato e sem eliminar journal, snapshot ou pendência. O arquivo de lock do fixture pode ser criado pelo mecanismo de leitura, mas os arquivos do journal/snapshots não são alterados.

O observador retorna um `SyntheticRekeyReconciliationInputLab` apenas para **diagnóstico de laboratório**. Sua evidência é sempre `SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY`: mesmo quando a geração PostgreSQL coincide perfeitamente com o ciphertext local, a política responde `HOLD_EXTERNAL_AUTHORITY_REQUIRED`. Só testes **hipotéticos** que substituem essa classificação por `VERIFIED_LIVE_CURRENT` conferem o resultado da matriz pura; isso **não executa** migração, não verifica login/owner e não aprova autoridade remota.

Os cenários implementados incluem:

- `PREPARED + OLD` no PostgreSQL: a análise reconhece que a migração ainda não foi confirmada e não limpa a pendência.
- `COMMITTED + OLD` remoto: journal durável pendente não deve avançar uma autoridade só por existir localmente.
- `COMMITTED + NEW` remoto: após CAS SQL persistido e **resposta perdida**, o teste observa o candidato novo íntegro e prova o recibo de UUID gravado; o diagnóstico hipotético permite finalizar, mas o observador real mantém o bloqueio.
- `CLEAN + NEW` remoto: somente após um **recovery chamado explicitamente pelo cenário descartável**, o estado local se apresenta consistente; um replay do ciphertext antigo com PostgreSQL avançado é classificado como rollback, não como geração corrente.
- `PREPARED + NEW` remoto: avanço remoto prematuro em relação ao journal local gera divergência que não pode ser consertada por rollback automático.
- `COMMITTED + NEW ativo + OLD` remoto: a substituição local ocorreu, mas a autoridade fictícia ainda não avançou; permanece bloqueada até reconciliação.
- `COMMITTED` com candidato adulterado: `FAIL_CLOSED` com journal e recibo mantidos para avaliação.

**Gates ainda bloqueados:** não existe serviço externo implantado, prova de frescor de servidor/contador monotônico autenticado, reconciliação transacional entre banco remoto e filesystem Android, credenciais reais, backup fora do dispositivo nem cobertura de falhas de energia física. O snapshot é sintético, e hashes do PostgreSQL não dão automaticamente confiança contra administrador hostil ou restore antigo do servidor. O experimento demonstra **classificação e observabilidade**, não um motor automático de recuperação.

## Assinatura legítima, resposta desatualizada e rollback do próprio PostgreSQL

A SEC-05K inclui `SyntheticJdbcSignedReadRaceLabTest.kt`, executado pelo `pgRekeyCasCheck` sobre o PostgreSQL descartável. O ensaio usa uma chave Ed25519 **temporária gerada no próprio processo de testes** para assinar uma afirmação de geração lida do banco, vinculada ao desafio aleatório do cliente. É uma simulação de protocolo, sem endpoint remoto e sem distribuição de chave confiável.

**Resultado de segurança negativo 1, TOCTOU:** a resposta é assinada corretamente quando a geração antiga está atual. O banco confirma um CAS para a geração seguinte **antes de o cliente verificar aquela resposta**. A assinatura da geração antiga continua válida para o desafio emitido, porque assinatura criptográfica não expira automaticamente quando os dados mudam. A política deve, portanto, classificar a evidência como `SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY` e retornar `HOLD_EXTERNAL_AUTHORITY_REQUIRED`. Desafio único impede replay de uma resposta destinada a **outro desafio**, mas não torna a afirmação verdadeira para sempre. O cliente deve verificar o estado transacional mais recente no momento de uma decisão sensível, seguindo protocolo com janela de frescor, token/época de autoridade e checagens atômicas ainda não implementados.

**Resultado de segurança negativo 2, restauração privilegiada:** em uma conta inteiramente fictícia da base de testes, depois de confirmar o CAS, o ensaio simula um administrador com poder de escrita que **restaura a geração antiga e elimina o recibo daquela operação** numa transação. Uma assinatura Ed25519 criada para um **novo desafio**, a partir desse banco já revertido, é criptograficamente válida. Logo, nem a assinatura nova nem o `SELECT FOR UPDATE` tornam o estado monotônico contra rollback total do banco. O sistema precisa de fonte externa genuinamente independente, protegido contra replay de banco/backup, que imponha o piso de geração e a cadeia de commits.

A verificação também inclui diferença entre chaves pinadas, mismatch de geração e consumo único do desafio. O laboratório imprime apenas contagem e estados, não dados financeiros ou chaves privadas. A manipulação do PostgreSQL é restrita a linhas aleatórias descartáveis da CI. **NÃO utilizar o teste como recurso de rollback real, nem o resultado `VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY` como permissão de migração.**

**Próximos gates:** arquitetura independente de contadores monotônicos autenticados, confiança inicial da chave, respostas assinadas vinculadas ao commit/UUID e período de validade comprovável, CAS durável sob falhas de energia e rollback de backup, reconstrução da autoridade, operação offline, e validação integrada Android/SQLCipher. A SEC-05K continua BLOQUEADA para produção.

## SEC-05K: referência assinada em uma JVM separada (prova de isolamento, não de durabilidade)

O ensaio `SyntheticIndependentGenerationFloorFixtureLab` executa um **processo JVM filho independente do cliente JDBC**, com uma chave Ed25519 gerada em sua própria memória e uma referência de geração mantida **somente no heap dessa JVM**. Uma interface textual restrita aceita `ENROLL`, `ADVANCE` condicional e `QUOTE` vinculada ao desafio aleatório do cliente. O processo não executa comandos SQL nem lê os recibos do PostgreSQL, e só recebe metadados opacos sintéticos. O comando de avanço recusa predecessor incorreto, regressão, saltos de geração, kit não renovado e novo enrollment enquanto há estado.

O `SyntheticJdbcIsolatedFloorRollbackLabTest`, executado pelo `pgRekeyCasCheck`, mantém essa JVM ativa enquanto um CAS é persistido no PostgreSQL de CI. Em seguida, o teste restaura **somente uma conta fictícia e seu recibo** para a versão anterior, por meio de SQL privilegiado. A JVM isolada continua emitindo uma resposta assinada para a geração nova. O teste então comprova que a resposta e os hashes do banco divergem. Repetir a alteração antiga na referência externa é recusado. A política `SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY` continua sempre retornando `HOLD_EXTERNAL_AUTHORITY_REQUIRED`.

O experimento também confirma que **uma assinatura antiga emitida antes do avanço pode permanecer criptograficamente válida após o avanço**; um nonce não resolve a corrida entre leitura e mudança do estado. Outra verificação comprova que chave pública errada não valida a assinatura da JVM independente.

**Resultado negativo indispensável:** finalizar a JVM destrói seu estado e sua chave Ed25519. Um processo novo pode aceitar novamente uma geração antiga. Portanto, embora a JVM isolada detecte uma regressão do PostgreSQL **enquanto continua viva e não é comprometida**, esse ensaio **NÃO implementa** uma autoridade remotamente implantada, imutável, monotônica entre reinícios, nem protege contra comprometimento simultâneo de ambos os processos. A chave pública é obtida do próprio processo filho, por **confiança no momento da criação**, não por pinning autenticado de produção. Um atacante que substitua o processo também pode substituir sua chave e inventar um estado arbitrário.

**Para sair do laboratório:** autoridade em ambiente e domínio de falha verdadeiramente independentes, persistência monotônica contra rollback de backup, identidade de servidor com trust anchor provisionada fora do canal, atestação de frescor e época, CAS e recibos transacionais, alta disponibilidade e reconciliação idempotente com o journal do dispositivo. A SEC-05K continua bloqueada para produção e não manipula fundos nem dados pessoais reais.

## SEC-05K: persistência independente entre reinícios (JVM e disco, fixture descartável)

O novo laboratório SyntheticPersistentIndependentFloorFixtureLab guarda um piso de geração em uma **pasta local separada do PostgreSQL**. Sua JVM filha não utiliza JDBC. O arquivo floor.state é assinado com Ed25519 e publicado por rename atômico com fsync de arquivo e diretório. Os marcadores identity.guard e enrolled.guard são escritos antes de seus respectivos estados: ausência posterior de chave/geração resulta em **recusa**, não em re-provisionamento automático. O FileLock é advisory e só coordena processos cooperativos.

O par de chaves Ed25519 é persistido fora do banco para que o processo novo mantenha a identidade anterior. **A chave privada PKCS8 está em claro na pasta temporária exclusiva do teste.** Isso não implementa isolamento criptográfico de produção, KMS, HSM, TEE, controle de acesso seguro nem provisionamento autenticado da chave pública. O cliente JVM do ensaio preserva/pina a chave pública recebida na criação; esse pinning não equivale à identidade de uma autoridade remota independente.

O teste SyntheticJdbcPersistentFloorRollbackLabTest está ligado ao job pgRekeyCasCheck: após persistir geração nova, encerra e reinicia o processo isolado, restaura apenas a geração e o recibo de uma **conta fictícia** no PostgreSQL e consulta novamente o piso assinado. Uma restauração *somente* do banco não reduz a geração que a JVM nova lê do armazenamento separado. Arquivo de piso truncado ou apagado após enrollment é recusado. Uma cópia íntegra da geração atual pode ser reapresentada manualmente no fixture descartável.

**Resultado negativo intencional: rollback da própria autoridade.** Ao restaurar um arquivo floor.state antigo com assinatura ainda válida, a nova JVM pode aceitar a geração antiga **mesmo mantendo a chave pública pinada**. Se a pasta e a chave privada também forem restauradas ou manipuladas pelo adversário, a fragilidade é ainda maior. Assinar um estado e sincronizá-lo em disco **não** produz monotonicidade irreversível. Uma cadeia de hashes inteiramente restaurável pelo mesmo adversário também não resolveria o problema. Essa limitação deve continuar explícita nos testes, sem maquiar o resultado.

**Gates BLOQUEADOS:** contador antirrollback respaldado por domínio de falha e armazenamento não restaurável pelo mesmo adversário (ou serviço durável com garantia equivalente), raiz de confiança provisionada, autenticação do titular, operações CAS com recibos e reconciliação transacional entre autoridades, proteção de chave em hardware/KMS, recuperação de falha física, backups realmente externos e integração Android/SQLCipher. Nenhuma aprovação de produção, nenhum merge, APK, instalação ou alteração das IAs na PR #17.

## SEC-05K: fronteira de contador externo protegido (somente modelo, NÃO é uma autoridade real)

O teste JVM SyntheticProtectedAnchorBoundaryLabTest separa duas fontes que um atacante consegue restaurar (PostgreSQL e cópia do piso assinado) de uma **terceira fonte hipotética**, com contador monotônico e operações CAS idempotentes. A terceira fonte existe **apenas como mapa em memória no processo de testes**, mantido fora das duas cópias restauráveis do cenário. Não existe serviço remoto implantado, storage imutável, TEE, TPM, HSM ou credencial do titular nesta implementação.

A matriz exercita: avançar uma geração e perder o ACK após gravar o recibo; retry idempotente com o mesmo UUID de operação; recusa de colisão do UUID com payload diferente; concorrência de seis chamadores onde apenas um CAS vence; remoção simultânea da geração nova do PostgreSQL e do arquivo assinado, detectada enquanto o terceiro piso simulado continua ativo; divergências entre as duas cópias; pin de identidade errado; substituição de autoridade com identidade diferente; separação por conta; recusa de rebootstrap e indisponibilidade temporária sem aceitar estado local antigo. Nenhuma mutação de dados reais é feita.

**Endurecimento da simulação:** recibos idempotentes deixam de retornar `ALREADY_APPLIED_FIXTURE_ONLY` depois que outra geração já foi confirmada: nesse caso respondem `DENY_STALE_RECEIPT_NOT_CURRENT`, pois histórico íntegro não é estado atual. O contador conserva cópias defensivas de claims e hashes de ciphertext, recusando a alteração indireta de memória pelo chamador após enrollment ou CAS. Cenários adicionais cobrem leitura previamente coincidente que se torna obsoleta, retry posterior ao avanço e adulteração de array compartilhado. São propriedades do **test-double JVM**, não evidência de proteção contra arquivos restaurados, comprometimento de chave ou rollback de hardware.

**Limite irredutível: não é uma autoridade real.** O contador do teste é volátil, sem autenticação, rede, timestamp confiável ou garantia contra reinício/restore dele próprio. O teste não tenta demonstrar que um contador físico antirrollback foi implantado. A observação positiva usa o nome OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION: uma leitura pode ficar desatualizada logo após sua emissão, de modo que nem coincidência de estados nem assinatura Ed25519 implicam autorização financeira. Nunca converter resultado do fixture em VERIFIED_LIVE_CURRENT.

**Gate BLOQUEADO para produção:** escolher e auditar um domínio de falha independente do PostgreSQL e dos arquivos do aplicativo, com garantias verificáveis de não redução do piso; provisionar e pinar identidade de autoridade por canal confiável; autenticar o titular; estabelecer linearização/frescor e protocolo de commit com recibos e retry seguros; tratar reconstrução de autoridade e indisponibilidade; validar energia, hardware, backups externos e Android/SQLCipher. Sem merge, APK, release ou alterações na PR #17.

## Faltam antes de produção

- **Backup externo real confirmado:** o parâmetro de envelope+segredo verifica criptografia, mas **não demonstra que o usuário salvou o segredo fora do dispositivo**. Queda após a decisão de commit pode tornar os dados inacessíveis se o único segredo ficou na memória do processo. Deve existir cerimônia de backup externo com prova segura, persistente e independente **antes** do commit, sem guardar o segredo em claro.
- Transação nativa entre banco cifrado, catálogo de gerações e credenciais recuperáveis. O journal aqui só cobre o arquivo sintético, não o SQLCipher.
- Autenticação forte do titular e controles de permissão/consentimento, serviços de autoridade, auditoria, múltiplos dispositivos, regras de revogação e concorrência entre hosts.
- Proteção autenticada contra rollback/tamper, estado monotônico externo e cadeia de custódia de backups; o checksum não protege contra um adversário ativo.
- Garantias formais sobre torn writes, falta de espaço, corrupção no próprio journal, sincronização física, crash de energia, backups remotos e restauração remota.
- Nenhuma versão atual garante apagar backups antigos copiados por um invasor. Uma DEK comprometida continua descriptografando ciphertext históricos preservados offline.

**Resultado permitido:** demonstração limitada e verificável de recuperação de processo para a fixture. **Resultado proibido:** afirmar que a SEC-05K concluiu o sistema de recuperação real ou aprovou lançamento.


## SEC-05K: referência persistida em JVM isolada (restauração só do PostgreSQL)

**Estado: fixture descartável JVM/CI, NÃO PRONTA PARA PRODUÇÃO.** A etapa seguinte ao piso volátil introduz o arquivo SyntheticDurableGenerationFloorFixtureLab.kt: processo independente que recebe somente IDs sintéticos de conta/kit, números de versão/geração e SHA-256 de ciphertext fictício. Estado e chave Ed25519 ficam em authority.state num diretório temporário da CI **fora do PostgreSQL e de seus backups**. ENROLL/ADVANCE gravam arquivo temporário, forçam sync em disco, publicam por ATOMIC_MOVE e sincronizam diretório **antes** de responder sucesso. FileLock entre processos coordena apenas operações cooperativas; leituras usam descriptor com NOFOLLOW_LINKS. provisioned.guard evita reinicialização silenciosa quando apenas o arquivo de estado desaparece, sendo escrito antes do primeiro estado. O checksum SHA-256 detecta *corrupção acidental*: não equivale a MAC nem previne replay.

O ensaio SyntheticJdbcDurableFloorRollbackLabTest.kt, conectado ao pgRekeyCasCheck, verifica com dados falsos que:

1. A referência avança em uma JVM, a JVM termina, uma nova JVM abre **o mesmo diretório** e recupera a geração NEW e a mesma chave pública Ed25519.
2. Restaurando **somente** a linha fictícia e o recibo CAS no PostgreSQL para OLD, a JVM reiniciada continua afirmando NEW em desafio fresco. ENROLL e ADVANCE com predecessor antigo são recusados. Isso comprova a fronteira de falha separada dos backups do PostgreSQL.
3. Corrupção do arquivo da autoridade é recusada; pin público incorreto não valida assinatura.
4. **Resultado negativo obrigatório:** restaurar o arquivo authority.state **da própria autoridade** para sua cópia antiga permite voltar a OLD e gerar uma **assinatura válida com a mesma chave pública anteriormente conhecida**. Assim, não existe monotonicidade contra invasor ou administrador que controle o armazenamento da autoridade. Mesmo assinatura válida com nonce novo não reconstrói história apagada.

Esse laboratório não cria backend implantado, HSM, KMS, storage WORM, contador seguro, identidade de servidor autenticada nem atomicidade entre PostgreSQL, journal Android e SQLCipher. A chave privada do teste fica deliberadamente em texto codificado, **insegura para produção**. FileLock é advisory; ataques de troca maliciosa de arquivos e TOCTOU permanecem fora da garantia. Nunca promover assinatura do fixture para VERIFIED_LIVE_CURRENT: preservar SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY e HOLD_EXTERNAL_AUTHORITY_REQUIRED.

**Gate seguinte:** autoridade verdadeiramente independente, identidade pinada fora do canal, contador monotônico resistente ao *restore do seu próprio estado*, registros auditáveis e recuperação após desastres. Exigir revisão de segurança, crash/power-loss e autorização do titular antes de integrar o app. **PR #14 continua draft. Sem merge, release, APK, dados reais ou modificações na PR #17 das IAs.**

**Teste adicional de perda completa:** remover apenas authority.state mantendo provisioned.guard causa recusa de inicialização e não deve gerar novo estado. Remover **ambos** os arquivos permite um novo provisionamento com outra chave e reenrollment da geração OLD. Isso delimita por que marcadores locais não substituem raiz monotônica inviolável.


## SEC-05K | Duas JVMs assinantes: divergência isolada e replay coordenado

**Escopo exclusivo de fixture Kotlin/JVM.** O experimento SyntheticDualDurableFloorAgreementLabTest.kt inicia duas JVMs filhas e dois diretórios temporários separados no **mesmo runner de CI**. Cada JVM guarda sua própria chave Ed25519 e o próprio estado persistente. Isso **não** constitui duas regiões, dois operadores, servidores remotos confiáveis, HSM, quorum inviolável, nem serviço de autenticação.

A política pura SyntheticDualFloorAgreementPolicyFixtureLab exige dois pins públicos distintos, dois desafios independentes de 32 bytes, a associação correta resposta/desafio e duas assinaturas Ed25519 válidas de **claims idênticos** (conta, kit, versão, geração e hash dos bytes cifrados). Sem testemunha, com chaves iguais, resposta trocada, assinatura adulterada ou claims divergentes, retorna HOLD, jamais prossegue. Mesmo se tudo coincidir, o único resultado permitido é AGREEMENT_FIXTURE_ONLY_NOT_LIVE_AUTHORITY; ele **não** vira VERIFIED_LIVE_CURRENT.

Cenários no runner policyCheck:
- A e B iniciam em OLD; avanço unilateral A=NEW, B=OLD implica HOLD_DIVERGENT_FLOORS. B só avança explicitamente a partir do seu predecessor OLD.
- Depois de avançar ambas até NEW e depois NEWER, as duas são reiniciadas em processos novos; chaves e geração NEWER persistem enquanto os arquivos continuam intactos.
- Restore **somente** do arquivo A para OLD, com B mantida em NEW, causa divergência assinada e bloqueio.
- **Teste negativo obrigatório:** restore de **ambos** os arquivos da autoridade, inclusive suas chaves de teste antigas, faz A e B concordarem na geração OLD, com assinaturas válidas sob os pins originais e nonces novos. Um acordo 2-de-2 em armazenamento comum pode portanto estar globalmente obsoleto.
- Duas respostas assinadas antes de um avanço permanecem matematicamente válidas depois dele. Nenhuma verificação local de assinatura elimina TOCTOU, e o teste conserva HOLD_EXTERNAL_AUTHORITY_REQUIRED na política de reconciliação.

**Risco residual:** não há garantia de estado monotônico contra comprometimento/restore conjunto das duas testemunhas. Diretrizes para etapa posterior incluem âncora externa com garantias documentadas de prevenção a rollback ou checkpoint imutável sob controle independente, política de bootstrap que recuse reset, provisionamento autenticado de chaves, frescor e commit linearizável, disponibilidade/reconciliação e auditoria por ameaça. HMAC/Ed25519 não substituem storage resistente a rollback. Não autorizar operações financeiras, não integrar com SQLCipher real ou Expo e não distribuir APK. **SEC-05K permanece bloqueada, PR #14 em draft e PR #17 intacta.**
