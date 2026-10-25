# P0-1 | Firewall de referencias a override OTA no codigo mobile

PR de laboratorio baseada na #66. Nao modifica a main e nao publica
releases. Mantem o canal `preview` de laboratorio, sem confundir
preview com atualizacoes assinadas de producao.

## Problema

As PRs #61-#66 verificam o endpoint, o canal e a versao OTA
registrados em `AndroidManifest.xml` e `resources.arsc` dos APKs
compilados e baixados. Essas verificacoes nao inspecionam por si so
chamadas de aplicativo que modificam configuracoes ou parametros
OTA em runtime.

## Mudancas

`tooling/android/verify_no_ota_runtime_override.cjs` realiza uma
inspecao somente leitura do codigo do aplicativo `apps/mobile`.
Inspeciona os arquivos de producao JS, TS, Kotlin e Java, incluindo
o modulo financeiro nativo Android `src/main`.

Bloqueia introducao reconhecivel de:
- `expo-updates` em imports `import`, `require` e `from`
  no codigo de aplicacao;
- namespaces/classes de configuracao nativa Expo Updates;
- APIs de alteracao de URL, request headers e parametros
  de atualizacao (`setUpdateURLAndRequestHeadersOverride`,
  `setExtraParamAsync`, etc.);
- chamadas explicitas do objeto `Updates` para
  `set*`, `configure*` ou `override*`.

O verificador nao segue symlinks, rejeita caminhos especiais,
arquivos muito grandes e reducao inesperada da superficie
auditada. Ignora codigo gerado em `apps/mobile/android` e
as implementacoes `src/androidTest` e `src/debug` nao
publicadas, que sao inspecionadas por verificacoes de compilacao
separadas. Plugins de prebuild permanecem analisados pelas
verificacoes de manifesto/recurso do APK real.

A CI Android executa o comando antes do `expo prebuild`, e
`npm test` cobre API proibida injetada, source root incompleto,
symlinks, Kotlin, imports dinamicos literais e CLI bloqueante.

## Limites

O controle e **heuristico/estatico**. Nao consegue demonstrar
ausencia absoluta de overrides dinamicos ocultos, dependencias
adulteradas, reflexao, strings montadas em execucao ou alteracoes
pelo sistema operacional. NAO substitui as auditorias de
`AndroidManifest.xml` compilado e `resources.arsc`, a
assinatura de codigo OTA, as politicas de publicador ou
os testes end-to-end num aparelho.

Nao se promove um aplicativo com OTA preview nao assinada a
releases de producao. Revisao humana e obrigatoria.
