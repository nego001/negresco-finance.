# Negresco Finance | Fase 1: fronteira da integração nativa com Expo

**Status em 22/10/2026:** diagnóstico integrado na tela Ajustes e módulo local Expo/Kotlin de diagnóstico criado no código-fonte; **NÃO** existem chaves financeiras, banco SQLCipher operacional, opt-out nativo completo, QA físico ou release seguro. O autolinking/compilação do módulo precisa ser confirmado no workflow Android para o commit exato. Sem autorização para dados reais, merge ou atualização de APK. PR #14 continua em draft.

## Mudança efetivamente realizada nesta revisão

- `apps/mobile/security/nativeFinanceReadiness.ts` mantém inspeção manual, somente leitura e sempre bloqueada; `apps/mobile/modules/negresco-finance-security/src/NegrescoFinanceSecurityV1.ts` resolve o módulo via `requireOptionalNativeModule('NegrescoFinanceSecurityV1')`, da Expo Modules API.
- `apps/mobile/App.tsx` inclui botão em **Ajustes → Segurança financeira nativa**. A inspeção ocorre apenas depois do toque do usuário, sem argumentos financeiros. Ausência do módulo é exibida claramente, não interpretada como proteção.
- O resultado do host é **descartado**: mesmo que ele alegue `ready`, `VERIFIED_LIVE_CURRENT`, KeyStore ou SQLCipher, todas as saídas retornam `financialStorageAllowed=false`, `keyReleaseAllowed=false`, `migrationAllowed=false`. Erro ou host ausente também fecham.
- Respostas assíncronas após saída de Ajustes ou background são ignoradas por uma época local. Nenhuma operação de segurança toma decisão com base nesse valor JS.
- `tests/native-finance-readiness.test.mjs` cobre ausência, plataformas diferentes, host falso, exceções e isolamento da UI.
- **Existe agora um módulo Kotlin local implementando apenas `getIntegrationInfo()`**, com flags falsas e sem operações financeiras. É uma implementação de diagnóstico, ainda sem comprovação de execução em hardware ou integração das políticas Kotlin/SQLCipher de laboratório. Isso NÃO constitui um controle criptográfico, de acesso, de biometria ou cofre.

## Tratamento de falhas na consulta diagnóstica

A inspeção manual do módulo opcional agora possui **limite máximo de cinco segundos** e captura também falhas ao consultar a propriedade `getIntegrationInfo` em objetos hostis ou proxies JS. Exceção nativa, getter que lança erro, promessa que nunca resolve e resposta atrasada **não** concedem acesso: `financialStorageAllowed=false`, `keyReleaseAllowed=false` e `migrationAllowed=false` permanecem fixos. Erros internos não mostram mensagens potencialmente sensíveis na UI.

A expiração encerra apenas a **espera da interface**; não cancela nem reverte uma operação Kotlin. Isso é aceitável aqui somente porque a futura interface `getIntegrationInfo` está contratualmente limitada a diagnóstico **sem mutação**. O módulo nativo real deverá ter cancelamento/ciclo de vida próprios e nunca reutilizar esse resultado como autorização de chave ou banco. Testes regressivos específicos estão em `tests/native-finance-readiness.test.mjs`. Nenhum binário nativo novo foi conectado nesta revisão.

## Primeiro módulo local Expo Android, somente diagnóstico

**Implementação de código (sem homologação de aparelho):** criado
`apps/mobile/modules/negresco-finance-security/` com configuração de
autolinking Expo, Gradle Android library e a classe Kotlin
`NegrescoFinanceSecurityV1Module`. A classe exporta **somente**
`getIntegrationInfo()`, sem parâmetros ou operações financeiras, e devolve
`DIAGNOSTIC_ONLY` com os cinco campos de segurança fixos como `false`.
A UI do app consulta o módulo via `requireOptionalNativeModule`, mecanismo
do Expo Modules API, não através de `React Native NativeModules`.

Nenhum componente de DataStore/SQLCipher/Keystore foi importado para esse
módulo, nenhuma permissão extra foi solicitada e nenhuma chave é gerada,
aberta ou exportada. O diagnóstico continua manual e todos os caminhos
`financialStorageAllowed`, `keyReleaseAllowed` e `migrationAllowed`
permanecem desativados no TypeScript, independentemente de uma resposta
potencialmente forjada. O teste `tests/native-finance-expo-module-contract.test.mjs`
impede exportações acidentais de funções financeiras pelo módulo.

A presença do módulo num APK **não significa** que segurança nativa ou banco
criptografado estejam prontos. CI Kotlin/Android, build de APK de testes e
homologação física devem validar a compilação antes de considerar essa
primeira integração tecnológica concluída; ela ainda **não** satisfaz os
gates de proteção financeira, opt-out atômico ou recuperação. A build
automática de artefatos de CI nunca autoriza publicação estável ou instalação
no aparelho existente.

## SEC-05 | Prova de uso AndroidKeyStore dentro da estrutura Expo (emulador, não APK)

O código de **instrumentação exclusivamente de teste** do módulo local está em
`apps/mobile/modules/negresco-finance-security/android/src/androidTest/java/com/negresco/finance/security/SyntheticNativeKeystoreRoundTripTest.kt`.
Ele cria uma chave **efêmera** AES-256-GCM no provider `AndroidKeyStore`, autentica
a criptografia de bytes fictícios, reabre a chave no mesmo dispositivo, detecta
adulteração da tag GCM e remove o alias aleatório em bloco `finally`. Não registra
nem transmite chaves, IVs, dados ou ciphertext. A chave é criada **sem exigência
de autenticação** (`setUserAuthenticationRequired(false)`), justamente para
não confundir este teste do mecanismo criptográfico com aprovação de biometria,
CryptoObject, hardware dedicado, armazenamento SQLCipher ou autorização financeira.

O job CI `expo-native-diagnostic-compile` compila também as fontes de
instrumentação, e o novo job `expo-native-diagnostic-emulator` as executa
em um Android 35 descartável. O segundo job compila/instala um pacote
**de teste instrumental**, NÃO gera APK de distribuição nem altera o app
que o usuário tem instalado. O arquivo de produção
`NegrescoFinanceSecurityV1Module.kt` continua expondo apenas
`getIntegrationInfo()` como diagnóstico sem autoridade. O módulo não possui
operação de dados financeiros, autorização, persistência, SQLCipher ou migração.

**Critério pendente:** obter logs do emulador com os testes aprovados; em
seguida integrar uma operação nativa com banco SQLCipher **também sintético**
e, separadamente, autorização vinculada a BiometricPrompt/Keystore, sessão
e lifecycle. Mesmo uma CI totalmente verde não comprova proteção em um
Samsung real nem segurança contra rollback de um serviço externo.

## SQLCipher dentro do `androidTest` Expo (somente dados descartáveis)

O fixture `SyntheticExpoSqlcipherPersistenceTest.kt` exercita a biblioteca
pinned `net.zetetic:sqlcipher-android:4.19.1` e
`androidx.sqlite:sqlite:2.7.0` **apenas via `androidTestImplementation`** do
módulo local Expo. Os testes criam bancos em diretórios aleatórios do cache
do **emulador descartável**, carregam a biblioteca JNI, escrevem uma linha
inventada, fecham/reabrem com a senha sintética correta, tentam leitura com
chave errada sob `OPEN_READONLY` e confirmam que uma transação sem commit
não sobrevive à reabertura. Arquivos de teste, WAL, SHM e journal são apagados
em `finally` pela rotina de limpeza; nada é gravado no banco do app real.

**Limites:** a senha do fixture é gerada em RAM e **não** é envolvida por
Android Keystore/BiometricPrompt; o banco não contém finanças reais nem
autorização de sessão. O teste não faz backup, migração, restauração,
sincronização ou release; o módulo Kotlin exportado continua exclusivamente
de diagnóstico e reporta `sqlcipherIntegrated=false`,
`financialStorageAllowed=false`. Provar criptografia de um banco sintético
no emulador é um passo de engenharia, **não** permissão para gravar saldos.

**Critério de aceite desta etapa:** job `expo-native-diagnostic-emulator`
precisa executar e aprovar testes `androidTest` reais, junto com a matriz
Node `native-finance-sqlcipher-instrumentation.test.mjs`. A CI anterior
#39796759531 tinha falhas no contrato de número de funções diagnósticas e
no shell do emulador. Foram corrigidas em commits subsequentes; não marcar
concluída até aprovação da nova execução. Persistência financeira real
permanece bloqueada até chaves nativas vinculadas a autenticação, gestão de
ciclo de vida, migração/backup e QA no Samsung.

## Key-wrapping sintético no módulo Expo: AndroidKeyStore → SQLCipher

Após validação da CI #39802901753 (**9/9**, incluindo 14 testes instrumentados), uma
nova classe **exclusivamente** em `src/androidTest` exercita a união dos dois
mecanismos: `SyntheticKeystoreWrappedSqlcipherLifecycleTest.kt`. Um alias
AndroidKeyStore aleatório protege por AES-256-GCM uma senha SQLCipher inventada;
o envelope cifrado é vinculado por AAD a uma identidade de conta fictícia e ao
nome do banco. Um novo acesso ao provider recupera a senha para reabrir o banco
descartável. Adulteração da tag, troca do vínculo de conta e perda do alias
devem causar bloqueio, sem criar outro banco ou destruir o ciphertext existente.
Arquivos e alias temporários são removidos em `finally`.

O teste explicita que a chave **não exige biometria**
(`setUserAuthenticationRequired(false)`). A API de SQLCipher usada nesta
fixture converte a senha a `String` na JVM; portanto, apagar `ByteArray`
não comprova eliminação de todas as cópias em memória. A proteção forte
dos segredos, o ciclo de vida, a retenção dos dados reais e a autorização do
titular dependem de outro contrato de implementação e homologação.

Não foram acrescentadas funções de gravação, abertura de banco ou liberação
de chave à interface Expo. O `NegrescoFinanceSecurityV1Module` continua
devolvendo `financialStorageAllowed=false`, `keyReleaseAllowed=false` e
`sqlcipherIntegrated=false`. Nenhum dado pessoal, financeiro ou aplicativo
instalado é afetado.

**Critério de aceite da nova etapa:** `expo-native-diagnostic-compile` deve
compilar o `androidTest`, `expo-native-diagnostic-emulator` deve executá-lo,
e o contrato `native-finance-keywrap-lifecycle.test.mjs` deve passar. Mesmo
com CI verde, isso é demonstração de integração criptográfica com senha de
teste, não um cofre financeiro pronto.

## Etapa negativa: chave AndroidKeyStore exigindo BIOMETRIC_STRONG

A fixture `SyntheticStrongBiometricKeyDenialTest.kt` está somente em
`src/androidTest` do módulo Expo e exige uma chave AES-GCM AndroidKeyStore
com `setUserAuthenticationRequired(true)`,
`setUserAuthenticationParameters(0, AUTH_BIOMETRIC_STRONG)` e invalidação por
alteração do cadastro biométrico. Ela **não apresenta prompt nem simula a
aprovação de uma digital**. Sem uma operação autorizada via
`BiometricPrompt(CryptoObject)`, uma tentativa de criptografia deve ser
recusada; se o emulador sequer permitir criar a chave por ausência de
biometria/cadastro seguro, isso também é registrado exclusivamente como
capacidade indisponível e bloqueada. Todo alias efêmero é removido em
`finally`.

**Uma CI verde nessa fixture não significa autenticação biométrica funcional
ou segurança financeira homologada.** É uma prova **negativa** (negação antes
da autorização) e não um teste positivo de uso após aprovação do usuário.
Ainda será necessário implementar na camada nativa um fluxo de consentimento
vinculado ao próprio `CryptoObject`, proteger a senha SQLCipher com esse
fluxo, bloquear operações por sessão/foreground, lidar com alteração de
cadastro, key-loss, migração, backup e homologar no Samsung físico.
Nenhuma interface JavaScript recebe chave, senha ou bit de autorização;
`financialStorageAllowed=false` e `keyReleaseAllowed=false` continuam.

## Interface futura mínima (NÃO DISPONÍVEL)

A implementação de diagnóstico usa um módulo local Expo Kotlin **identificado por versão**; qualquer API real de autenticação, persistência ou chaves depende integralmente dos gates abaixo. A superfície JS deve ser mínima:

| Operação | Resultado para JS | Autoridade |
| --- | --- | --- |
| `getIntegrationInfo()` | Diagnóstico de versão/instalação, somente informativo | Não pode habilitar banco/chaves; resposta não confiável |
| `readPublicLockPresentation()` (eventual) | Estado de UI sem segredo, sem capability de autenticação | Nativo DataStore é fonte de verdade; JS apenas desenha |
| `requestUnlock()` (futuro e condicionado) | UI pode pedir operação, mas nunca fornecer `authenticated=true` | BiometricPrompt/CryptoObject e sessão/KeyStore nativos |
| `requestDisable()` (futuro e condicionado) | Não expor enquanto opt-out transacional não for comprovado | Atualmente `disable()` deve permanecer DENIED |
| Acesso à base financeira (futuro) | Somente comandos de negócio limitados e autorizados | Chave e banco permanecem exclusivamente no processo nativo, sem API `getKey` |

**Proibido:** método JS `unlockWithBoolean`, `forceDisable`, chave da base em memória JS, fallback para AsyncStorage/SQLite comum, re-enrollment automático após corrupção, recuperação por alegação de assinatura/nonce de fixture ou leitura do banco em claro sem autorização nativa.

## Dependências concretas antes de conectar Kotlin ao produto

1. **Comprovar compilação do módulo local Expo para Android**, em projeto específico do app e com versionamento/compatibilidade ABI; manter `tooling/native-lock-android-lab` e `tooling/sqlcipher-android-lab` como fixtures separadas.
2. **Autenticação e opt-out**: integrar DataStore e BiometricPrompt à Activity, controlar background/restart, autenticação por operação e revogação; concluir fluxo de desativação sem lacuna de commit. NUNCA usar retorno de login visual como chave de dados.
3. **Proteção criptográfica**: gerar e envelopar chave SQLCipher separada com Android Keystore; testar CryptoObject, mudança de biometria, perda de chave, fallback e política de backup.
4. **Banco financeiro**: SQLCipher real dentro do app, chave errada/ausente não cria banco novo, integridade WAL, esquema/migrações e operação offline com dados sintéticos.
5. **Assinatura e migração**: identidade de assinatura permanente, pré-verificação de APK existente, preservação de preferências/Guardião e plano de recuperação antes de trocar o binário. APK atual é Debug e não pode receber atualização se certificados forem incompatíveis.
6. **QA/auditoria**: testes CI Kotlin/Node/emulador **e** Samsung físico com consentimento e dados fictícios, ameaças, privacy/logs, auditoria de dependências. Guardar evidência do commit, certificado e modelo testado.

**Critério de saída:** só chamar “integrado” quando existir binário compilado, instalação homologada, chaves, banco e regras de autenticação nativas validadas. A nova UI diagnóstica isolada não satisfaz nenhum dos gates de criptografia ou release.

## Próxima entrega de código recomendada

Extrair interfaces nativas testáveis de `tooling/native-lock-android-lab` para um módulo local Expo **desabilitado por padrão**, começar pelo caminho de leitura do DataStore e diagnósticos, e implementar o ciclo de vida/opt-out com testes instrumentados antes de criar métodos para manipular bancos. Não publicar APK, não mesclar PR #14 nem tocar na PR #17 até confirmação do usuário e revisão específica.


## Atualização: esqueleto nativo Android local criado (ainda diagnóstico)

O módulo `apps/mobile/modules/negresco-finance-security` registra a classe Kotlin `com.negresco.finance.security.NegrescoFinanceSecurityV1Module` pelo `expo-module.config.json` Android-only. A classe oferece exatamente `getIntegrationInfo()` e responde `financialStorageAllowed=false`, `keyReleaseAllowed=false`, `migrationAllowed=false`, `sqlcipherIntegrated=false`, `hardwareKeyAuthorizationIntegrated=false`. Ela não lê arquivos, não solicita permissões, não cria banco, não utiliza Keystore e não contém biometria. A fachada TypeScript usa `requireOptionalNativeModule`, permitindo rodar em binários antigos sem o módulo. A inspeção de dados retornados continua sendo **não autoritativa** em `nativeFinanceReadiness.ts`.

**Compatibilidade:** o aplicativo usa Expo SDK 54. O Gradle do módulo foi alinhado ao `ExpoModulesCorePlugin.gradle` do template dessa versão, com `applyKotlinExpoModulesCorePlugin()`, `useCoreDependencies()` e `useDefaultAndroidSdkVersions()`. Essa configuração **precisa ser compilada e conferida pelo workflow Android/APK em GitHub Actions**; contratos JS ou compilações dos projetos `tooling/` não comprovam esse resultado.

O workflow Android APK existente é disparado por mudanças em `apps/mobile/**` e pode gerar um **artefato Debug de teste**. Isso não publica automaticamente uma versão estável, não instala no Samsung e não autoriza migração, mesmo que um futuro build seja aprovado. Antes de considerar a próxima fase concluída, conferir log de `expo prebuild`, compilação Gradle, pacote/assinatura, e executar QA físico consentido com dados fictícios. A proteção financeira continua BLOQUEADA.


## Diagnóstico passivo da presença de DataStore (nova subetapa)

O módulo Kotlin agora oferece **`inspectNativeLockStorePresence()`**, além de `getIntegrationInfo()`. Não abre nem instancia DataStore, não lê ou decodifica seus bytes, não cria diretórios/arquivos, não migra preferências JS, não persiste mudanças e não executa biometria. Examina exclusivamente metadados do nome reservado `files/datastore/negresco_native_lock.preferences_pb` na sandbox do próprio app, sem enviar caminho, conteúdo, chave ou revisão ao JavaScript.

A checagem retorna somente `ABSENT`, `PRESENT_UNVERIFIED`, `UNSAFE_ENTRY` ou `UNAVAILABLE`. Diretórios/arquivos simbólicos, arquivos que não sejam regulares, sem leitura ou maiores que 1 MiB são sinalizados como inseguros. Sistemas anteriores à API 26 retornam indisponível. Mesmo `PRESENT_UNVERIFIED` **não autentica versão, revisão, integridade, estado enabled, titular ou dispositivo**. O arquivo pode estar corrompido, adulterado ou ter sido restaurado de backup. É uma inspeção passiva e está sujeita a condições de corrida no filesystem.

O TypeScript chama opcionalmente essa função somente após o botão de Ajustes, dentro do mesmo timeout global de cinco segundos do diagnóstico. Interpreta apenas rótulos limitados, sem propagar respostas arbitrárias do host. `financialStorageAllowed`, `keyReleaseAllowed` e `migrationAllowed` permanecem `false` para TODOS os resultados; a leitura não cria capacidade de autenticação nem de acesso. Testes Node protegem contra claims forjados, respostas desconhecidas, falhas de inspeção e timeout. O teste do contrato nativo proíbe métodos de leitura/escrita de bytes, migração e emissão de APIs de desbloqueio.

**Gates ainda pendentes:** leitura tipada de DataStore com instância única vinculada à Activity, migração transacional do estado legado, autenticação forte nativa, opt-out seguro, autorização de chave via Keystore/CryptoObject, SQLCipher dentro do aplicativo e QA físico Samsung. **Nenhum deles foi satisfeito por este diagnóstico de presença.** Sem APK estável, merge ou uso de dados reais.


## Leitura tipada em Android isolado, sem autorização (Fase 1, subetapa seguinte)

Foi adicionado `NativeLockTypedSnapshotClassifier.kt` ao módulo Android, **não exportado** por `NegrescoFinanceSecurityV1Module`. O classificador recebe um `Preferences` já lido e examina, com chaves tipadas, somente `protocol_version`, `enabled`, `revision` e `disable_pending`. Os resultados possíveis são `MISSING_REQUIRES_VERIFIED_MIGRATION`, `INVALID_LOCKED`, `UNSUPPORTED_VERSION_LOCKED`, `PENDING_DISABLE_LOCKED` ou `VALID_UNTRUSTED`. Mesmo o último resultado não autentica quem gravou os dados, não garante que a revisão é atual e **não significa desbloqueado**. Registros habilitados ou desabilitados são tratados igualmente como não confiáveis, sem autorizar opt-out.

A leitura efetiva de um `DataStore<Preferences>` ocorre **somente na suíte Android de instrumentação** `SyntheticTypedNativeLockSnapshotTest.kt` usando `PreferenceDataStoreFactory`, arquivos temporários com UUID sob `noBackupFilesDir` da aplicação de teste e limpeza após cancelar a scope. As oito situações cobrem vazio, tipagem válida sem liberação, estado desabilitado sem autorização, estado pendente, inconsistência de pending, revisão negativa, esquema futuro e campo obrigatório ausente. A base DataStore **já usada pelo app não é aberta**. Em produção, somente `getIntegrationInfo()` e `inspectNativeLockStorePresence()` são exportados, e nenhuma API lê ou escreve preferências tipadas.

A próxima etapa de implantação deve estabelecer **instância única DataStore por arquivo/processo**, observação com revogação de sessão, estado de migração atômico, gestão do ciclo de vida Activity e validação em hardware. A simples capacidade de analisar uma preferência tipada em laboratório não elimina restore/replay, conflito entre escritores nem a lacuna de opt-out. **SQLCipher e acesso financeiro real permanecem bloqueados.**

### Pendências de CI desta subetapa

A CI anterior `39796759531` apresentou 7/9 jobs aprovados. O contrato Node falhou porque um teste antigo contava uma única função pública depois da adição do segundo método diagnóstico, e o novo emulador Expo não conseguiu conectar o daemon ADB durante o boot; este último erro ocorreu **antes de executar testes**. O contrato foi ajustado para enumerar os dois métodos existentes. Os novos testes de DataStore e eventuais correções de infraestrutura só devem ser considerados aprovados após logs do novo HEAD.


## Leitor tipado com DataStore injetado, apenas em instrumentação

A próxima pequena integração de Fase 1 adicionou `NativeLockReadOnlySnapshotReader.kt`. O leitor **aceita por injeção** um `DataStore<Preferences>` que já tem um responsável, chama `data.first()`, encaminha o snapshot a `NativeLockTypedSnapshotClassifier` e retorna apenas um rótulo de classificação. Ele não contém `PreferenceDataStoreFactory`, caminho de arquivo, operação `updateData`, migração, nem API de desbloqueio. Erros de leitura retornam `STORAGE_ERROR_LOCKED`; cancelamento de coroutine é propagado para preservar o ciclo de vida. `VALID_UNTRUSTED` continua sem autorizar qualquer operação.

`SyntheticReadOnlyNativeLockReaderTest.kt` fornece a **única instância DataStore** para um arquivo aleatório sob `noBackupFilesDir`, nunca para o arquivo persistido do app. Cinco testes Android instrumentados cobrem snapshot ausente, estados ligado/desligado sem autenticação, `disablePending` contraditório ou pendente, valor com tipo errado e leituras concorrentes pela mesma instância. Outros dois testes, em `SyntheticReadOnlyNativeLockErrorTest.kt`, injetam um DataStore que falha: erro de leitura retorna `STORAGE_ERROR_LOCKED` e cancelamento de coroutine é propagado. Todos os sete casos continuam isolados de dados reais. A criação/edição de preferências existe **exclusivamente no fixture de teste**, não no leitor e não no aplicativo distribuído. `tests/native-finance-readonly-datastore-contract.test.mjs` preserva essa fronteira.

**Ainda não implementado:** instância única de DataStore de produção, observador contínuo de revogação na Activity, migração de preferências legadas, reconciliação com biometria e Keystore, desbloqueio nativo ou SQLCipher com autorização. Nenhum método de leitura do snapshot foi exportado ao módulo Expo. Este trabalho precisa passar na compilação Android e no emulador do commit exato antes de ser considerado validado. O APK instalado no telefone permanece inalterado.
