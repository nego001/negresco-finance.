# Negresco Finance | Contrato de persistência nativa do bloqueio (proposta V1)

**Status: núcleo Kotlin/JVM com DataStore e migração experimental; laboratório Android com um coordenador nativo para desbloqueio e ativação, ainda fora do Expo. A desativação está propositalmente bloqueada. Ainda NÃO há leitura das preferências legadas no aparelho, integração Expo, chaves Keystore reais ou homologação no Samsung.**
O APK 3.1.2 continua usando AsyncStorage e autenticação de interface.
Este arquivo **não** autoriza migração automática, dados financeiros reais,
assinatura de produção, alegação de transação nativa ou uso do Keystore como
prova de chave bancária segura.

## Problema comprovado

O protocolo JS atual grava dois registros de preferência: o estado principal
`negresco.local_lock.v1` e o diário `negresco.local_lock.optout.v1`.
Reiniciar entre gravações costuma manter o bloqueio, mas a exclusão final do
diário não é cancelável. Um encerramento naquele ponto pode deixar
`disabled` gravado sem o diário. A interface de JS só recebe notificações
de AppState e não consegue serializar fisicamente a gravação no Android.

## Escolha proposta

- Criar módulo **local** Expo para Android com código Kotlin. É necessário
  novo APK compilado, com `runtimeVersion` e `versionCode` próprios;
  **não** ativar via OTA em runtime 3.1.2.
- Guardar apenas preferência de habilitação e versão de protocolo em um
  único registro tipado no Jetpack DataStore. Usar `updateData` e ler
  o mesmo snapshot, sem copiar duas chaves para JS.
- A autorização para desativação deve ocorrer **dentro do fluxo nativo**
  com BiometricPrompt e, futuramente, operações reais vinculadas ao
  Android Keystore. Um booleano `authenticated=true` vindo de JS jamais
  pode autorizar a desativação.
- Serializar pedidos de alteração e eventos de ciclo de vida do Activity,
  atribuindo geração monotônica à sessão. Se `onStop`/background for
  processado antes do commit, recusar o pedido. Se o commit tiver sido
  concluído enquanto a sessão ainda estava válida, tratá-lo como operação
  concluída; nunca representar uma operação incompleta como confirmada.
- Erro de leitura, versão desconhecida, corrupção ou indisponibilidade
  do módulo é **bloqueio**, não fallback silencioso para AsyncStorage.
- Não transmitir templates biométricos, segredos, chaves ou dados de banco
  pelo bridge JS, logs, analytics ou PDF.

## Interface de alto nível (não disponível no app)

```text
NativeLock.readSnapshot() -> {
  protocolVersion, enabled, locked, revision, recoveryRequired
}
NativeLock.requestEnable() -> resultado após autenticação + commit nativos
NativeLock.requestDisable() -> resultado após autenticação + commit nativos
NativeLock.lockNow() -> revogação de sessão volátil
NativeLock.observeState() -> notificações não autoritativas para atualizar UI
```

O código JS jamais recebe uma função `forceDisable`, `skipBiometric` ou
um token reutilizável para confirmar uma operação. O resultado retornado
pela ponte é informativo: a **fonte de verdade** é o estado nativo persistido
e a sessão nativa. A abertura da interface não equivale à liberação de chaves
criptográficas.

## Migração sem perda de dados

1. Manter o adaptador atual no APK 3.1.2, sem alterar a preferência existente.
2. Implementar o módulo no ramo de teste, sem substituir o fluxo de produção.
3. Em nova versão de APK com assinatura compatível, validar `versionCode`,
   `runtimeVersion` e hash de certificado antes de tentar atualização.
4. Para a migração, ler os registros legados uma única vez. `enabled`,
   `disable-pending` e diário `pending` permanecem protegidos; estados
   inválidos não podem virar `off`. `null`/ `disabled` precisam de política
   de compatibilidade expressa, sem interpretar ausência como recuperação
   criptográfica e sem transformar um marcador adulterável em autenticação.
5. Registrar estado de migração e versão no mesmo armazenamento transacional
   nativo; em falha, exibir erro protegido, nunca excluir o estado legado.
6. Exigir teste de upgrade em Samsung com somente dados fictícios antes de
   colocar o módulo em uso. Não desinstalar o app para resolver assinatura.

## Matriz obrigatória de testes

- Bloqueio após restart, AppState inactive/background, retorno, rotação de
  Activity, morte de processo e cancelamento do prompt.
- Concorrência de duas desativações, ativação simultânea, troca de digital,
  ausência de biometria forte e queda de processo antes/durante/após commit.
- Corrupção e versões futuras do registro: sempre bloquear e permitir
  diagnóstico sem apagar dados.
- Falha de I/O em `updateData`: nenhuma operação falsa aprovada.
- APKs assinados de modo compatível: migração com dados sintéticos preservados;
  rollback de APK tratado como caso distinto, não presumido seguro.
- CI compilando Kotlin/Expo em ABIs suportadas e QA físico no Samsung.
- Segurança de captura de tela e rotas do Guardião após reiniciar.

## Gates para implementação

- [ ] Módulo Kotlin e integração Expo local implementados e compilados.
- [ ] Persistência nativa de uma única fonte de verdade implementada.
- [ ] BiometricPrompt e transição de estado serializados no nativo.
- [ ] Mecanismo de migração de preferência testado contra encerramentos.
- [ ] Revisão do modelo de ameaça e testes adversariais aprovados.
- [ ] Assinatura estável, migração de APK e QA físico no Samsung aprovados.
- [ ] Só então retirar o protocolo JS de dois registros.
- [ ] SQLCipher, E2EE, gestão de chaves e recuperação continuam gates
      independentes e **não são entregues por este módulo**.

## Referências técnicas

- Android Jetpack DataStore: https://developer.android.com/topic/libraries/architecture/datastore
- Android BiometricPrompt CryptoObject e autorização de chave:
  https://developer.android.com/reference/android/hardware/biometrics/BiometricPrompt.CryptoObject
- Expo Modules API: https://docs.expo.dev/modules/get-started/


## Protótipo de política Kotlin (não integrado)

O núcleo `tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/NativeLockCoordinator.kt`
implementa lógica de geração de sessão, revogação no background, rejeição de
versões e revisões inválidas e serialização de solicitações de prompts.
A interface `AtomicLockStore` é **somente um contrato**, sem código DataStore.
A interface `NativeBiometricVerifier` é **somente um contrato**, sem BiometricPrompt.

Foram executados 10 cenários Kotlin locais no compilador JVM; o job
`native-lock-spike` no CI deverá compilar e executá-los a cada alteração.
O protótipo fica deliberadamente **fora de `apps/mobile/modules`**, para não
ser descoberto pelo autolinking nem alterar o APK 3.1.2. Sua existência não
aprova os gates de implementação nativa, persistência atômica, migração,
assinatura, segurança bancária ou QA físico.


## Persistência experimental com DataStore

`DataStoreLockRecordRepository.kt` usa a API real `androidx.datastore:datastore-preferences-core:1.2.1` em um projeto JVM isolado. A revisão do registro usa um único `updateData` transacional para versão de protocolo, estado habilitado e número de revisão. Não há operação de inicialização permissiva: registro ausente exige migração, registro parcial/versão desconhecida falha fechado.

Os testes do laboratório usam um arquivo `.preferences_pb` temporário e verificam reabertura, revisão obsoleta, escritas concorrentes, corrupção e versões futuras. **Isso não é integração Android nem garante autenticação nativa.** A antiga API genérica `compareAndSet(expectedRevision, targetEnabled)` foi eliminada: o repositório experimental só expõe `enableIfCurrent`, que grava `enabled=true` sob uma operação nativa autorizada. Estados desativados nos testes vêm de arquivos sintéticos, não de uma API de desativação disponível ao app.


## Adaptação Android isolada (sem integração com o aplicativo)

O diretório `tooling/native-lock-android-lab` compila uma biblioteca Android
independente. `NativeLockAndroidStore.kt` mantém uma única instância DataStore
por processo e arquivo; `StrongBiometricPrompt.kt` usa a dependência estável
AndroidX Biometric 1.1.0, exige `BIOMETRIC_STRONG`, não permite fallback de
credencial de dispositivo e tenta cancelar a autenticação em `onStop`.

**Limite crítico:** o retorno Boolean do prompt não prova autorização para
alterar o DataStore, e NÃO é exposto à ponte JS. Ainda falta um coordenador
suspenso que valide geração de sessão, transição de Activity e revisão do
registro no commit. Não chamar um prompt bem-sucedido de autorização de chave
Keystore ou transação bancária. A compilação do laboratório no CI somente
confirma tipos/dependências, não o comportamento em aparelhos reais.

### Migração compatível, conservadora

`LegacyLockMigrationPolicy.kt` diferencia os registros antigos:

- `enabled`, `disable-pending` ou diário `pending`: migrar **somente
  para bloqueado**;
- `disabled` ou ausência de preferência e diário: exigir decisão explícita
  de configuração, sem criar registro nativo desligado automaticamente;
- valores inesperados, diário malformado: recusar;
- registro nativo existente: preservá-lo sem substituí-lo pela origem legada.

`migrateLegacyLocked` faz o registro inicial bloqueado com `updateData`
idempotente. A extração dos dados legados no dispositivo, o consentimento
para quem tinha opt-in desligado e a seleção transacional da origem ainda
não foram implementados. O CI JVM exercita **10 cenários de política +
15 de DataStore/migração**, mas não substitui QA em Samsung ou análise
de segurança independente.


## Coordenador Android experimental: autorização conservadora

`NativeLockAndroidLabSession` liga o `StrongBiometricPrompt`, o DataStore
por processo e o `SuspendingNativeLockCoordinator`. O coordenador mantém
geração de sessão sincronizada com `onStop`, cancela autorizações antigas,
serializa prompts, verifica revisões persistidas e só abre sessão ao concluir
sem mudança de Activity. O desbloqueio fica associado à revisão do registro: mudanças externas,
ausência de registro e dados corrompidos revogam a autorização em memória.
A confirmação do prompt exige Activity em `RESUMED`. **Desativar o bloqueio retorna DENIED** por projeto:
permitir o opt-out antes de garantir atomicidade com a revogação do Android
reintroduziria o problema crítico de desativação após background.

Esse laboratório **não** expõe métodos JS, não integra o APK 3.1.2 e
não utiliza segredos financeiros nem Android Keystore como fonte de chaves.
Seus testes JVM são simulados; a compilação Android confirma apenas
compatibilidade de código. É obrigatório testar autenticação real,
cancelamento, rotação de Activity e troca de digitais num aparelho de teste.

## Observação persistente e revogação imediata (laboratório)

O adaptador Android experimental agora observa o `Flow` do DataStore em uma
coroutine própria da Activity. Uma revisão alterada, um registro removido
ou um erro de decodificação revoga imediatamente a sessão **quando o evento
é recebido**, sem depender de o usuário abrir outra tela. A verificação
direta no `snapshot()` continua necessária porque eventos assíncronos podem
atrasar. Em falha de observação, o acesso fica revogado e a recuperação
exige reinicializar o observador sob controle nativo.

**Não é uma barreira de segurança criptográfica:** uma notificação pode
chegar após a alteração no disco, e a interface não está ligada a esse
laboratório no APK 3.1.2. Ainda falta revogação vinculada ao ciclo de vida
real, testes no Samsung e transação segura para desativar a biometria.


## Gate de saúde do observador (laboratório)

O `NativeLockAndroidLabSession` agora exige uma primeira emissão válida do
`Flow` DataStore antes de permitir desbloquear/ativar proteção. A perda do
observador, seu término inesperado, dados ausentes ou inválidos deixam uma
falha **travada** na Activity: nova leitura isolada ou um evento posterior
aparentemente válido **não** restauram a autorização. Uma Activity nova
pode recriar o observador, mas ainda deverá receber um registro válido e
executar biometria novamente. Preferência nativa `enabled=false` com
versão e revisão válidas **não** é erro de armazenamento, portanto continua
possível ativar biometria com autenticação forte.

Essa política limita a janela de uso sem monitoramento nativo; eventos ainda
podem atrasar e não constituem proteção criptográfica dos dados. Não está
integrada ao APK instalado, e não autoriza desativação biométrica.

## Fase 1 do opt-out transacional (laboratório, não operacional)

O DataStore experimental agora armazena `disablePending=true` como fase de
preparação **ainda protegida**, numa transação junto de `enabled=true` e da
revisão monotônica. `prepareDisableForLab()` solicita autenticação forte
pelo contrato nativo e, após validação de geração, retorna exclusivamente
`PREPARED`. **Nunca afirma que o bloqueio foi desativado.**

Se o processo ou a Activity forem interrompidos, o estado persistente
continua habilitado. `recoverPreparedDisable()` rearma a proteção,
rejeita corrupção e é idempotente. Durante a fase pendente, consultas ao
coordenador não desbloqueiam a interface e atualizações genéricas da
preferência são recusadas. A migração anterior não sobrescreve a fase pendente.

**Importante:** a fase final `enabled=false` ainda NÃO foi implementada
nem autorizada, porque a revogação síncrona do ciclo de vida e a conclusão
durável do DataStore precisam de um protocolo linearizável. Esse método de
preparação nem sequer é exportado pelo adaptador Android e, portanto,
não participa do APK 3.1.2. SQLCipher, Keystore com chaves reais,
assinatura e homologação no Samsung continuam pendentes.

## Auditoria de bypass legado e gravações interrompidas

Além do coordenador coroutine, existia um coordenador Kotlin síncrono de
laboratório que ainda permitia `DISABLE` com um armazenamento simulado.
Essa via foi **fechada**: os dois coordenadores recusam a desativação final.
O caminho síncrono também revoga desbloqueios antigos após alteração na
revisão do registro ou falha de leitura.

Três testes sintéticos controlam a suspensão da gravação (1) antes da
persistência do marcador `disablePending`, (2) após persistir e antes do
retorno de `updateData`, e (3) cancelamento depois de persistir.
O estado permanece sempre `enabled=true`, e a recuperação também mantém
o bloqueio. Uma conclusão tardia após `onStop` não pode ser informada como
preparação bem-sucedida: o resultado é `STALE`.

A confirmação final que gravaria `enabled=false` permanece **não
implementada**. Simulação JVM e compilação Android não comprovam a
linearização do ciclo de vida contra uma gravação durável. É necessária
uma revisão específica desse protocolo antes de testes físicos e
integração com Expo.
