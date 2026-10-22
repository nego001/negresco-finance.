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
