# SEC-05 | Segunda referência local para journal de migração sintético

**Escopo: somente Android instrumentation (`src/androidTest`), dados fictícios, Fase 1.** Este procedimento NÃO migra o aplicativo real, NÃO abre SQLCipher financeiro, NÃO executa uma interrupção real de processo e NÃO constitui uma autoridade contra rollback.

## Problema que o ensaio demonstra

O journal anterior `SyntheticAtomicMigrationJournal` usa `AtomicFile` e um SHA-256 **sem chave** para identificar corrupção acidental. Um invasor ou uma restauração antiga consegue devolver um journal com checksum válido e uma sequência anterior, e `inspectExisting()` ainda retorna um `HOLD` genérico. O checksum sozinho não detecta esse replay.

## O segundo arquivo de referência

`SyntheticJournalIndependentWitness` cria, no **mesmo sandbox aleatório descartável** de `noBackupFilesDir`, um arquivo separado: `synthetic-migration.witness`. Ele contém a sequência, a etapa fictícia e o digest do conteúdo canônico esperado de `synthetic-migration.journal`, com checksum próprio, num segundo `AtomicFile`. Um par só é considerado *consistente como diagnóstico* se:

- ambos os arquivos estão presentes, têm tamanho limitado e UTF-8 válido;
- a referência tem campos, sequência, etapa e checksums sintaticamente válidos;
- o journal efetivamente salvo equivale exatamente ao checkpoint esperado.

A gravação de teste começa pelo **witness** e só então pelo journal. Uma falha entre os dois deixa arquivos divergentes e produz `DENY_SYNTHETIC_PAIR_MISMATCH`. A inspeção com ambos ausentes retorna `HOLD_SYNTHETIC_PAIR_ABSENT`; apenas um presente é `DENY_SYNTHETIC_PAIR_INCOMPLETE`; um par coerente ainda retorna **`HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY`**, nunca `ALLOW`.

## Matriz de nove testes Android

`SyntheticJournalIndependentWitnessTest.kt` cobre ausência dos dois arquivos; reabertura em outra instância; gravação interrompida com `AtomicFile.failWrite` depois de avançar o witness; replay unilateral do journal antigo; replay unilateral do witness antigo; ausência de apenas um arquivo; corrupção/truncamento/UTF-8 inválido/limite de 256 bytes; formato não autorizado; e restauração simultânea dos dois arquivos antigos.

**Limitação essencial:** se os dois arquivos locais forem restaurados para a mesma geração anterior, os checksums vão coincidir. Esse teste deve demonstrar exatamente essa falha de detecção. Nem uma segunda cópia no próprio aparelho, nem SHA-256, nem o nome `noBackup` são uma autoridade independente. Um mecanismo real precisará de geração autenticada e protegida contra rollback fora do mesmo domínio de restauração, recuperação supervisionada e provas de interrupção de processo/reboot; nada disso foi implementado nesta etapa.

`failWrite` simula cancelamento da transação e persistência do último checkpoint, **não** equivale a `kill -9`, morte do processo ou queda de energia. Nenhum teste deve ser rotulado como prova de crash real.

## Critérios e restrições

A CI precisa passar nos contratos Node, compilar o `androidTest` e executar os novos cenários no emulador do módulo Expo. Mesmo com resultado verde, a migração de produção e os dados do titular continuam bloqueados: `financialStorageAllowed=false`, `keyReleaseAllowed=false`, `migrationAllowed=false`. Não há merge, release, APK instalado, dados bancários, biometria positiva ou PR #17 alterados.

Status de homologação física: **não executada**.
