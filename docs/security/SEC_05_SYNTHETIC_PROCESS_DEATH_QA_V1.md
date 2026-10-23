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

## Limites explícitos

- Um `SIGKILL` após um ponto de escrita conhecido **não** simula queda elétrica ou inconsistência de storage físico, nem determina exatamente a durabilidade de `fsync` em todos os hardwares.
- A segunda cópia ainda está no mesmo domínio local; restaurar ambas as gerações antigas juntas continua indetectável. É necessária autoridade de geração externa e autenticada para recuperação de produção.
- Os testes requerem compilação e execução real do emulador Expo. O resultado desta CI precisa ser confirmado antes de declarar os três casos aprovados.
- O job de compilação inclui verificação do AAR Release: tanto a Activity biométrica Debug quanto o trabalhador de crash precisam estar ausentes de `classes.jar` e do manifesto da biblioteca Release. Esse gate **não** substitui inspeção do APK de produto final.
- `financialStorageAllowed=false`, `keyReleaseAllowed=false` e `migrationAllowed=false` continuam invariantes no módulo Expo. PR #14 em draft, sem merge ou publicação; PR #17 não é alterada.
