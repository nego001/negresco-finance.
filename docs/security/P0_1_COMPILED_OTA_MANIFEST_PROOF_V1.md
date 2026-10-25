# P0-1 | Auditoria de assinatura OTA no AndroidManifest compilado

Revisão isolada em branch e PR draft empilhada sobre a #58.
Nenhuma publicação, merge na main, criação de chaves ou atualização OTA.

## Risco residual

A #57 valida app.json/certificado publico; a #58 verifica o XML nativo
gerado por Expo. AAPT2/Gradle ainda podem converter ou alterar o
AndroidManifest.xml. O bytecode OTA e a assinatura Android do APK nao
substituem a auditoria dos metadados de verificacao de updates.

## Implementacao

`tooling/android/verify_compiled_ota_manifest.py` abre o APK ZIP exato,
exige um unico AndroidManifest.xml regular e limitado e interpreta
diretamente o formato Android Binary XML (AXML). O parser valida limites
dos chunks, tabelas de strings UTF-8/UTF-16, elementos, atributos
tipados, unicidade de application e meta-data e rejeita estruturas
incompletas/ambiguas. Nao executa codigo do APK.

Em `--verify-stable <apk> <app.json>` exige:

1. `embedded-only`: config `updates.enabled=false` explicita e
   `expo.modules.updates.ENABLED=false` do tipo boolean no APK;
   nenhum metadado de assinatura OTA.
2. OTA assinada: `ENABLED=true` boolean; PEM literal compilado
   identico ao certificado publico configurado; JSON literal de
   `CODE_SIGNING_METADATA` com mesmo `alg` e `keyid`.
   Campos ausentes, inesperados, duplicados, caminhos de
   certificado inseguros e referencias indiretamente compiladas
   sao negados.

O workflow posiciona a verificacao de estabilidade depois do
`apksigner` e antes de qualquer upload de artefato, **apenas**
para dispatch manual de `main` solicitando assinatura estavel
ou publicacao. Os gates de origem e manifesto gerado continuam
obrigatorios antes do Gradle.

Em `--parse-only <apk>`, a CI de preview exercita o parser contra
um **APK real compilado**, mas NAO aprova seguranca OTA nem compara
assinatura. Essa distincao e intencional.

## Testes adversariais

`tests/android-compiled-ota-manifest.test.mjs` produz manifests
binarios com valores legitimos e adulterados, empacota APKs ZIP
sinteticos, executa o Python real e verifica bloqueios para
certificado substituido, alg/keyid incorretos, missing/duplicate
metadata, boolean mal tipado, elementos fora de application,
ZIP duplicado, XMLE corrompido, symlinks e divergencia de configuracao.

## Pendencias e limitacoes

- A build preview nao possui certificado de assinatura OTA;
  releases estaveis permanecem bloqueadas. O caminho real de
  build assinada requer certificado/chave de producao e teste em
  aparelho, sem expor credenciais.
- O job publicador privilegiado (sem checkout) ainda nao faz
  esta checagem OTA de modo independente no APK baixado.
  Futura PR separada deve repetir a prova com codigo fixo no workflow.
- Sem uma verificacao de atualizacao OTA assinada de ponta a ponta
  no dispositivo, o sistema nao esta homologado para producao.
- A publicacao segue desligada e exige autorizacao explicita e
  revisao humana.

Referencias tecnicas:
https://docs.expo.dev/eas-update/code-signing/
https://docs.expo.dev/versions/latest/sdk/updates/
