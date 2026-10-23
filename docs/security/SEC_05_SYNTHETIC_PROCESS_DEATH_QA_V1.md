# SEC-05 | Morte real do processo de journal sintético

**Escopo:** exclusivo para a biblioteca Android Debug, testes instrumentados de emulador e arquivos descartáveis de `noBackupFilesDir`. Não é migração real, nem um mecanismo antirrollback de produção. Nenhuma instalação, versão Release, conta ou dado financeiro é alterado.

## O que mudou em relação ao `AtomicFile.failWrite()`

O teste anterior chamava `failWrite()`, um rollback controlado na mesma execução. O novo `SyntheticJournalCrashWorkerService` corre em **processo Android separado** `:negresco_synthetic_journal`, restrito ao manifesto `src/debug` com `android:exported=false`. A instrumentação envia um comando explícito por `Messenger`; o serviço grava somente dentro de `noBackupFilesDir/negresco_synthetic_atomic_<UUID>` com marcador de posse do teste, confirma o ponto de interrupção por IPC e então executa **`Process.killProcess(Process.myPid())`** no seu próprio PID. O processo de instrumentação permanece vivo, observa `ServiceConnection.onServiceDisconnected` e reabre os checkpoints com novas instâncias.

Não existe endereço ou caminho arbitrário fornecido por terceiros, acesso a DataStore verdadeiro, migração de usuários, chave do cofre ou chamada de backend. O serviço não pode ser iniciado por outros aplicativos.

## Cenários instrumentados

O teste `SyntheticJournalActualProcessDeathTest.kt` cobre:

1. **Após commit do witness, antes do journal:** a geração esperada avançou, mas o journal antigo persiste. A reabertura precisa resultar em `DENY_SYNTHETIC_PAIR_MISMATCH`.
2. **Durante escrita incompleta do journal:** após gravar o witness, o processo escreve parcialmente o novo `AtomicFile` e morre sem `finishWrite` nem `failWrite`. A leitura posterior recupera a geração anterior e detecta divergência.
3. **Após commit dos dois arquivos:** o processo morre depois das duas gravações. A reabertura pode observar o par coerente, mas retorna somente `HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY`, nunca autorização.

A suíte confirma que o **PID do trabalhador é diferente** do processo de instrumentação e observa a morte do processo antes de inspecionar o par. Todos os arquivos pertencem a sandbox descartável e são apagados ao fim de cada teste.

## Cinco cenários negativos adicionais (somente instrumentação)

Após a correção do nome do processo Android, a [CI #39883347793](https://github.com/nego001/negresco-finance./actions/runs/39883347793) concluiu **9/9 jobs SUCCESS** no commit `20f2e076`; o emulador Expo registrou **83 testes iniciados** e `BUILD SUCCESSFUL`. Isso valida os três cenários de interrupção da versão anterior, não estes cinco testes novos.

A nova revisão acrescenta cinco testes no mesmo `SyntheticJournalActualProcessDeathTest`, cada um com journal e witness válidos preparados em diretório isolado antes da tentativa. O processo remoto responde `DENY_*` e é encerrado; o runner confere PID distinto, morte do processo e reabertura. Também compara **byte por byte** os dois arquivos anteriores e verifica que o par segue coerente, sempre em `HOLD_*`, nunca em autorização de migração:

1. UUID malformado ou tentativa de atravessar caminho: `DENY_TOKEN`.
2. UUID bem formado sem diretório de teste correspondente: `DENY_SANDBOX`.
3. Modo desconhecido: `DENY_MODE`.
4. Marcador `.synthetic-test-owner` ausente: `DENY_SANDBOX`.
5. Marcador de posse adulterado: `DENY_SANDBOX`.

São verificações de recusa e **não demonstram** segurança diante de um processo hostil com permissão de escrita no mesmo diretório, symlink/TOCTOU, atacante com controle da sandbox, parada elétrica ou proteção monotônica externa. Os resultados dos cinco novos testes dependem de uma nova execução concluída da CI.

## Contenção de links simbólicos nos arquivos descartáveis (nova revisão)

A inspeção original usava `File.isDirectory` e `File.isFile`, que **seguem links simbólicos**. Um link no marcador de posse, ou nos nomes usados por `AtomicFile`, poderia redirecionar uma leitura/gravação dentro da sandbox sintética. A revisão adiciona `hasReservedSymlink` ao serviço Debug: antes de tocar os checkpoints, rejeita links no diretório, marcador de posse, arquivos `journal`/`witness` e respectivos irmãos `.new` e `.bak`. Até links quebrados são recusados, retornando `DENY_PATH_ALIAS`.

O diretório e o marcador passam a ser verificados com `LinkOption.NOFOLLOW_LINKS`. O marcador também precisa ter comprimento igual ao token UUID esperado, antes da leitura. Falhas nessas condições respondem `DENY_SANDBOX`; os checkpoints não são reescritos.

**Quatro testes instrumentados adicionais, perfazendo doze nesta classe:** symlink do marcador de posse para fixture externa; symlink em `synthetic-migration.witness.new`; symlink em `synthetic-migration.journal.new`; marcador de posse maior que o esperado. Cada teste exige recusa, bytes de journal/witness preservados e estado `HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY`. Os três testes com links também conferem que o arquivo externo descartável mantém seu conteúdo original. O contrato Node passa a exigir essas proteções e a contagem de doze testes.

**Resultado dos quatro testes novos: pendente de CI.** O bloqueio é uma inspeção antes de escrever, não um handle seguro transacional. Um atacante com permissão de substituir caminhos após essa conferência ainda pode explorar uma corrida TOCTOU; hardlinks, mount points e antepassados hostis continuam fora de escopo. O objetivo continua estritamente de QA sintético, nunca prova de isolamento para dados financeiros.

## Hard links nos checkpoints (revisão de laboratório a validar)

A verificação anterior de links simbólicos não impede que dois nomes de arquivo referenciem o mesmo inode físico por meio de **hard links**. O serviço Debug agora inspeciona com `android.system.Os.lstat` os sete nomes reservados (owner, journal, witness e os auxiliares `.new`/`.bak`). Qualquer arquivo existente que não seja regular, ou cujo `st_nlink` exceda 1, é recusado com `DENY_HARDLINK`. Somente `ENOENT` é aceito para arquivos auxiliares ausentes; erros inesperados de stat são recusados.

Três testes instrumentados novos, elevando a classe a **15 testes**, criam hard links reais no mesmo `noBackupFilesDir`: marcador de posse, `witness.new` e `journal.new`. Cada um exige resposta de recusa, conteúdo externo intacto e journal/witness válidos preservados byte a byte. O cleanup usa `Files.deleteIfExists` para manter a limpeza idempotente.

**Resultado observado na CI #39890890098:** o Android recusou `Files.createLink` com `AccessDeniedException` nos três testes de hard links, antes da chamada ao worker. O serviço não foi exercitado nesses casos. Em um dispositivo sem permissão para criar o link, a instrumentação deve verificar que o bloqueio preserva os bytes anteriores e marcar o caso como **SKIPPED por limitação do kernel/filesystem**, jamais como validação positiva do gate `st_nlink`. Para atestar esse gate, será preciso um ambiente controlado capaz de criar hard links em diretório descartável.

**Não considerar esses três testes aprovados sem uma nova CI completa e execução em ambiente que permita o link.** `lstat` antes da escrita continua sujeito a corrida TOCTOU com um processo capaz de alterar a pasta. Não é defesa completa contra escritores hostis, mounts maliciosos ou hardlinks criados após a inspeção; não é integração financeira ou antirrollback de produção.

## Interrupção controlada entre duas verificações (nova revisão de laboratório)

O worker Debug agora verifica os nomes reservados **novamente após gravar o witness e antes de abrir o journal**. Dois modos estritamente sintéticos injetam, dentro da própria sandbox, um symlink ou um hardlink `journal.new` apontando para o marcador de posse **após** a primeira verificação. A segunda recusa retorna `DENY_PATH_ALIAS` ou `DENY_HARDLINK`, sem gravar o journal. A testemunha já avançou e o journal antigo permaneceu intacto, portanto `inspectPair()` deve retornar `DENY_SYNTHETIC_PAIR_MISMATCH`, nunca aprovação ou recuperação silenciosa.

Dois novos testes instrumentados elevam a classe a **17 cenários**. Se o kernel recusar a criação do hardlink com `AccessDeniedException`, a operação retorna `DENY_PLATFORM_HARDLINK` e o teste registra um **skip explícito após verificar a preservação dos dados**, sem afirmar que o bloqueio `st_nlink` foi exercitado. Também verificam que o arquivo de posse e os bytes anteriores do journal são preservados e que o alias temporário é eliminado sem seguir seu alvo. O contrato JS impede a perda desses modos e dos checks redundantes.

**Essa é uma demonstração reprodutível de um intervalo específico**, e não uma solução TOCTOU geral. Um invasor com permissão de escrita pode substituir os caminhos imediatamente após a segunda verificação. Confinamento real exige um desenho com descritores, acesso privado a diretórios e revisão específica Android. Nada concede autorização financeira.

## Marcador de posse por descritor e aliases de backup (revisão de laboratório pendente)

A leitura do UUID do marcador `.synthetic-test-owner` agora utiliza `Os.open` com `O_NOFOLLOW` e `O_CLOEXEC` em vez de `File.readText()`. O serviço faz `fstat` no descritor aberto para verificar arquivo regular, exatamente uma referência física (`st_nlink=1`) e comprimento esperado, depois lê bytes do mesmo descritor e compara o UUID. Falhas de abertura, metadata ou leitura recusam a sandbox. Isso impede que a troca da última componente por symlink entre pré-checagem e abertura faça o serviço seguir um caminho externo; não impede substituição de diretórios ancestrais ou TOCTOU nos nomes de `AtomicFile`.

Dois testes instrumentados adicionais, elevando a classe a **19 cenários**, verificam links simbólicos `synthetic-migration.witness.bak` e `synthetic-migration.journal.bak`. Cada um exige `DENY_PATH_ALIAS`, journal/witness intactos e destino externo descartável inalterado. Arquivos auxiliares eventualmente removidos pelo reader são limpos de modo idempotente, sem seguir o destino.

**Status: não validado em emulador.** Esta revisão só deve ser integrada depois da aprovação da compilação Android e, posteriormente, dos testes instrumentados. A segurança de produção, a eliminação geral de TOCTOU, defesa contra rollback externo e proteção de dados financeiros reais permanecem fora do escopo.

## Troca do marcador após a inspeção (novo teste de laboratório)

A classe recebe o vigésimo cenário: o serviço Debug move seu próprio marcador de posse para `.synthetic-owner-moved-for-test` e cria, **após a inspeção inicial**, um link simbólico no nome antigo apontando para os **mesmos bytes do UUID**. Uma leitura pelo caminho seguiria esse link e aceitaria o conteúdo; a leitura atual por `Os.open(...O_NOFOLLOW)` deve responder `DENY_SANDBOX`. A instrumentação verifica a morte do processo dedicado, bytes de journal e witness intactos, marcador real intacto, e restaura o marcador após remover o alias.

Esse é um ensaio determinístico da proteção do último componente do caminho, e não demonstra proteção contra trocas dos diretórios ancestrais. **Pendente de compilação e testes Android reais.**

## Arquivo especial no marcador de posse (21º caso, laboratório)

A abertura do marcador agora usa `O_NONBLOCK` além de `O_NOFOLLOW`, `O_RDONLY` e `O_CLOEXEC`. O `fstat` do descritor já rejeitava entradas que não são arquivos regulares; porém `open` em uma FIFO sem escritor **poderia bloquear antes de alcançar o `fstat`**. `O_NONBLOCK` reduz especificamente esse risco.

O worker Debug adiciona o modo `INJECT_OWNER_FIFO_BEFORE_OPEN_FIXTURE_ONLY`: depois dos primeiros checks, move o marcador real para um nome de teste e cria uma FIFO `0600` no nome do marcador. O 21º teste exige retorno `DENY_SANDBOX` com resposta e SIGKILL do processo separado, confirma que a entrada é FIFO e que os bytes de journal, witness e marcador original permanecem intactos. Desfaz a injeção antes da reabertura diagnóstica. **Não é prova de proteção contra todo tipo de arquivo especial ou TOCTOU; pendente de instrumentação Android.**

## Limites explícitos

- Um `SIGKILL` após um ponto de escrita conhecido **não** simula queda elétrica ou inconsistência de storage físico, nem determina exatamente a durabilidade de `fsync` em todos os hardwares.
- A segunda cópia ainda está no mesmo domínio local; restaurar ambas as gerações antigas juntas continua indetectável. É necessária autoridade de geração externa e autenticada para recuperação de produção.
- Os testes requerem compilação e execução real do emulador Expo. O resultado desta CI precisa ser confirmado antes de declarar os três casos aprovados.
- O job de compilação inclui verificação do AAR Release: tanto a Activity biométrica Debug quanto o trabalhador de crash precisam estar ausentes de `classes.jar` e do manifesto da biblioteca Release. Esse gate **não** substitui inspeção do APK de produto final.
- `financialStorageAllowed=false`, `keyReleaseAllowed=false` e `migrationAllowed=false` continuam invariantes no módulo Expo. PR #14 em draft, sem merge ou publicação; PR #17 não é alterada.
