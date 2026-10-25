# P0-1 | Auditoria OTA runtimeVersion no APK compilado

Esta etapa amplia a PR #62 e permanece separada da main.
Nenhuma tag, release, chaves privadas ou alteracao da configuracao do
aplicativo instalado foi criada.

## Lacuna de segurança

O plugin de Expo da #62 protege
`res/values/strings.xml` e rejeita redefinicoes `values-*`
**antes** do Gradle. Um processo de compilacao, otimizacao ou
empacotamento ainda pode alterar o resultado efetivo em `resources.arsc`.
Localizacoes Android selecionam recursos em runtime, entao uma
`expo_runtime_version` traduzida pode alterar a elegibilidade OTA.

## Implementacao

`tooling/android/verify_compiled_ota_runtime.py` recebe o APK exato,
o AAPT2 do Android SDK e a versao declarada pelo `app.json`.

- Verifica que o ZIP do APK inclui exatamente um
  `AndroidManifest.xml` e um `resources.arsc` regulares e limitados.
- Interpreta diretamente os bytes Android Binary XML (AXML) de
  `AndroidManifest.xml` do APK, com limites de tamanho, strings e
  atributos tipados. Localiza a meta-data
  `expo.modules.updates.EXPO_RUNTIME_VERSION` de `application` e
  exige uma referencia de recurso compilada TYPE_REFERENCE (0x01),
  nao uma string literal nem o texto variavel do AAPT2.
- Usa `aapt2 dump resources` no **mesmo APK** para encontrar esse
  ID, exigir o recurso `string/expo_runtime_version`, e comprovar
  a existencia de **exatamente uma configuracao default** com
  a versao autorizada.
- Bloqueia resource ID alterado, versao divergente, duplicacao,
  referencias indiretas, config localizadas (mesmo com valor igual),
  entradas malformadas e falha de parsing.
- Roda antes de qualquer `actions/upload-artifact`, depois da
  verificacao da identidade do APK e dos gates OTA existentes.
  Executa tambem nas builds de laboratorio, e nao exige ativar a
  assinatura de OTA para conferir um recurso compilado.

## Provas e limites

`tests/android-compiled-ota-runtime.test.mjs` exercita o auditor
Python real com APKs ZIP sinteticos e um simulador AAPT2 que emite
saidas verossimeis de manifesto e tabela de recursos. Inclui
variantes de idioma, ID substituido, valor trocado e arquivo ZIP
ambíguo. **Testes sinteticos nao equivalem a uma build real.**

A integracao com `Android APK (3.1.3 security preview)` testa a
leitura com o AAPT2 verdadeiro no artefato compilado pelo Gradle.
Uma futura etapa precisa repetir a auditoria em um
publicador isolado sobre o APK baixado, sem checkout.
Auditoria independente, homologacao OTA end-to-end em aparelho
e gestao de certificados permanecem obrigatorias antes de release.

Referencia: https://developer.android.com/tools/aapt2
