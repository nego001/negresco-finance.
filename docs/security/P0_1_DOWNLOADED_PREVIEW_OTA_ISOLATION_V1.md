# P0-1 | Reauditoria do canal OTA no APK baixado

PR DRAFT empilhada sobre #65. O objetivo e bloquear qualquer desvio
de canal ou endpoint Expo Updates no **APK baixado do laboratorio**,
sem alterar as politicas de publicacao.

## Risco

A #65 ja verifica, em job independente `contents:read`, o checksum,
a assinatura Android e a `runtimeVersion` compilada. Contudo, uma
versao OTA correta nao garante que o APK foi compilado com os
mesmos URL/canal ou sem metadados de assinatura OTA inesperados.

Um APK com `expo-channel-name=production` ou endpoint alterado nao
deve passar como candidato de laboratorio `preview`.

## Implementacao

- `tooling/android/verify_compiled_preview_ota.py` le o
  **AndroidManifest.xml binario** do APK, usando parser estrito com
  limites para tamanho, string pool, atributos duplicados e ZIP.
- Exige `expo.modules.updates.ENABLED` como booleano `true`.
- Exige `expo.modules.updates.EXPO_UPDATE_URL` como string literal
  `https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95`.
- Exige `UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY` como JSON literal
  exatamente `{"expo-channel-name":"preview"}`. Rejeita canais
  production/staging, cabecalhos extras e chaves JSON repetidas.
- Bloqueia qualquer `CODE_SIGNING_*` inesperado no APK preview.
  Uma atualizacao OTA assinada de producao teria outro perfil e
  **nao** deve ser confundida com esta build.
- O mesmo codigo verificado e incorporado como Python inline
  **no job independente de APK baixado** (`verify-downloaded-ota-runtime`),
  apos validacao SHA-256, assinatura Android e versao compilada.
  Nao executa codigo do ZIP nem faz checkout do repositorio.
- `tests/android-downloaded-preview-ota-isolation.test.mjs` executa
  o auditor Python standalone e a versao inline do workflow
  contra APKs sinteticos com Android Binary XML, incluindo injeções
  de signing metadata, troca de canal, troca de URL, XML invalido
  e entradas ZIP duplicadas.

## Limites

Este passo aprova apenas a **coerencia de configuracao binaria de um
APK de LABORATORIO**. O canal `preview` permanece com OTA remota
sem assinatura de codigo. Nenhuma prova de producao,
certificado X.509 de distribuicao, atualizacao assinada end-to-end,
loja de aplicativos ou release e validada aqui.

O publicador privilegiado permanece `SKIPPED` em PRs, exige disparo
manual e continua com politica propria mais restritiva
(production assinado ou embedded-only). A revisao humana continua
obrigatoria antes de qualquer merge/release.
