# SEC-05 | Teste físico com BiometricPrompt real (somente Debug)

**Estado:** harness preparado para compilação e QA. **Nenhuma aprovação biométrica física registrada.** Esta documentação não autoriza uso financeiro, merge ou release.

## Escopo técnico

A Activity `SyntheticBiometricManualQaActivity` está **somente em `apps/mobile/modules/negresco-finance-security/android/src/debug/`** e tem `android:exported="false"`. Não entra na variante Release, não é um botão no app instalado e não disponibiliza funções para JavaScript. O módulo de produção permanece apenas diagnóstico, com `financialStorageAllowed=false`, `keyReleaseAllowed=false` e `hardwareKeyAuthorizationIntegrated=false`.

Ela cria um alias aleatório AndroidKeyStore AES-256-GCM, `AUTH_BIOMETRIC_STRONG`, `setUserAuthenticationRequired(true)`, validade **zero** e invalidação ao alterar cadastro biométrico. Com consentimento real do Android, duas operações exigem **duas** aprovações por `BiometricPrompt(CryptoObject)`: primeiro cifrar `negresco-test-only`, depois decifrar e comparar os bytes. O callback sozinho não autoriza nada; cada chamada `doFinal` deve ser aceita pelo sistema. A senha e o banco SQLCipher real do app não participam.

O teste instrumentado `SyntheticBiometricManualQaOptInTest.kt` é desativado na CI normal via `Assume.assumeTrue`; nenhuma digital é simulada. Ele só abre a Activity em **dispositivo físico com bloqueio seguro e biometria forte cadastrada**, se receber argumento exato `negresco.manual.biometric=YES_PHYSICAL_CONSENT`. A Activity é não exportada, portanto o próprio teste autorizado inicia sua UI. O timeout de QA é 120 s e o teste falha se não houver resposta real.

## Procedimento de QA manual autorizado

1. Use **um Android de testes que você controla**, com biometria forte cadastrada e sem informações financeiras reais. Mantenha um backup independente antes de qualquer instalação de testes; a compatibilidade de assinaturas Debug/Release não foi homologada. **Não desinstale nem sobrescreva o Negresco Finance instalado para executar esse QA.**
2. Em um ambiente de desenvolvimento separado, execute `npm install` e `npx expo prebuild --platform android --non-interactive --no-install` dentro de `apps/mobile`. Conecte por ADB apenas o dispositivo de testes, com autorização explícita.
3. A partir de `apps/mobile/android`, a invocação Gradle prevista, **não executada por esta PR**, é:

   ```bash
   ./gradlew :negresco-finance-security:connectedDebugAndroidTest \
     -Pandroid.testInstrumentationRunnerArguments.class=com.negresco.finance.security.SyntheticBiometricManualQaOptInTest \
     -Pandroid.testInstrumentationRunnerArguments.negresco.manual.biometric=YES_PHYSICAL_CONSENT
   ```

   Confirme antecipadamente que o Android Gradle Plugin instalado repassa esses runner arguments na versão utilizada. A opção `class` limita a execução ao único teste manual; nenhum flag está configurado no workflow GitHub.
4. Realize **duas autenticações biométricas reais** na tela de QA. Verifique o resultado `PASS_NATIVE_CRYPTO_ONLY` e ausência de erros do provedor. Faça rodadas separadas cancelando no primeiro e segundo prompt, saindo do aplicativo, mudando de foco e revogando o cadastro biométrico no aparelho de teste. Após cada rodada, confira ausência de alias residual `negresco_manual_fixture_*`.
5. Registre apenas resultado, versão Android, fingerprint/build do dispositivo de teste, cancelamento, foreground/background e logs **sem chaves, IV, dados pessoais ou biometria**. Não registre modelos biométricos, prints do leitor ou dados bancários.

## Gate binário Release na CI

O job `expo-native-diagnostic-compile` agora inclui
`:negresco-finance-security:bundleReleaseAar` para compilar apenas a
**biblioteca Android Release**, sem gerar ou publicar APK de aplicativo.
Após a compilação, a CI inspeciona `classes.jar` e
`AndroidManifest.xml` do AAR. Exige a presença da classe normal
`NegrescoFinanceSecurityV1Module` e rejeita a presença de
`SyntheticBiometricManualQaActivity` em qualquer um dos dois arquivos.

Esse gate detecta vazamento acidental da tela de QA da variante Debug
para a **biblioteca Release**. Ele não substitui a inspeção do APK final,
não prova compatibilidade de assinatura/atualização e não torna a
biometria positiva do produto aprovada. O teste manual permanece
excluído das execuções automáticas, por exigir consentimento real.

## Critérios de bloqueio

- **PASS_NATIVE_CRYPTO_ONLY** demonstra somente que duas operações AES-GCM com chave temporária exigiram consentimento real. **Não** demonstra SQLCipher financeiro, recovery, logout, alto nível de assurance, attestation, antirollback ou autorização de usuário para qualquer saldo/transferência.
- Se não houver `BIOMETRIC_STRONG`, a atividade retorna `HOLD_NOT_ENROLLED`. Erros, cancelamento, foreground perdido, ciphertext incorreto e CryptoObject divergente permanecem HOLD/DENY; jamais fazer fallback silencioso para PIN ou chave sem biometria.
- O alias é apagado quando o teste termina ou Activity deixa foreground. O teste usa exclusivamente dados fictícios e não deve ser distribuído como funcionalidade do app. O binário de lançamento futuro exige verificação independente de **ausência** do código Debug e assinatura de distribuição compatível.
- Uma CI verde comprova somente compilação e os testes automatizados de negação/configuração; o teste **positivo físico continua PENDENTE** até receber evidência real, revisada, dessa execução manual.

**Rastreio:** [PR #14](https://github.com/nego001/negresco-finance./pull/14) (draft). Não tocar PR #17, não publicar APK e não instalar em aparelhos do usuário a partir deste trabalho.
