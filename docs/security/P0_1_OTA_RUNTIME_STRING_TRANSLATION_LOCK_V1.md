# P0-1 | Expo OTA runtimeVersion: Android string nao traduzivel

Etapa em PR **draft** empilhada sobre a #61. Nenhuma release e nenhum
merge para a main sao feitos nesta alteracao.

## Risco real

O Expo SDK 54 registra a versao de runtime OTA no AndroidManifest como
`expo.modules.updates.EXPO_RUNTIME_VERSION=@string/expo_runtime_version`.
A versao efetiva vem de `res/values/strings.xml`. Como o Android
seleciona strings conforme a localidade, traducoes inseridas por ferramentas
de distribuicao ou plugins podem substituir a versao original e impedir a
recepcao de updates compativeis. Esse problema foi documentado pela
comunidade Expo em 2026.

## Mitigacao implementada

- Config plugin `withNegrescoOtaRuntimeLock` usa o mod
  `withStringsXml` para marcar exatamente uma entrada
  `expo_runtime_version` com `translatable="false"` e valor
  derivado de `expo.version`, exigindo
  `runtimeVersion.policy="appVersion"`. Entradas duplicadas, versao
  divergente e atributo concorrente `translatable=true` bloqueiam
  a geracao.
- O auditor Python `verify_generated_ota_runtime.py` comprova que o
  AndroidManifest nativo aponta para o recurso correto e que
  `res/values/strings.xml` contem exatamente uma versao literal
  com `translatable=false` e valor identico a `app.json`.
- Tambem inspeciona todos os XMLs `res/values*/` do projeto gerado,
  rejeitando alternativas localizadas, inclusive
  `<item type="string" name="expo_runtime_version">`.
- A verificacao bloqueante executa apos Expo prebuild e antes do Gradle
  para builds de laboratorio e futuras builds estaveis.
- Testes adversariais exercitam o plugin real com mod simulado e o
  auditor Python verdadeiro em XMLs gerados sinteticos.

## Limites e gates de homologacao

A prova acima verifica arquivos **nativos gerados**, nao resolve
a possibilidade de transformacao por ferramentas terceirizadas
de distribuicao apos o build. Uma auditoria posterior de
`resources.arsc` no APK final e na distribuicao segue como
proxima etapa antes de aprovar uma release estavel.

O modo OTA do app continua no canal `preview`, ainda sem assinatura OTA,
e as politicas das PRs #57-#61 continuam obrigatorias. Testes end-to-end
de updates assinados em dispositivo real e revisao das configuracoes
de traducao automatica da loja sao etapas externas necessarias.

Fonte tecnica: https://github.com/expo/expo/issues/48148
Documentacao oficial: https://docs.expo.dev/eas-update/getting-started/
