# P0-1 | Expo app.config dentro do APK baixado

PR de laboratorio empilhada sobre #67. Sem merge na main, sem release,
sem credenciais de producao e sem permissao de escrita no job de
revalidacao.

## Observacao concreta no APK da PR #67

O APK real de laboratorio, artefato
`negresco-finance-v313-test-apk` do run `40173545263`,
possui `assets/app.config` (956 bytes), alem de
`AndroidManifest.xml` e `resources.arsc`. O JSON embutido inclui
`runtimeVersion`, `updates.url`, `updates.requestHeaders`,
`extra.eas.projectId` e `android.versionCode`.

Os verificadores anteriores validam o manifesto binario, a
runtimeVersion compilada e o isolamento do canal preview, mas nao
essa segunda representacao de configuracao distribuida dentro do APK.

## Controle novo

`tooling/android/verify_packaged_expo_config.py` interpreta
`assets/app.config` do **mesmo APK baixado**, bloqueando:
- entradas ZIP ausentes, repetidas, links ou tamanhos excessivos;
- JSON invalido, chaves repetidas, valores JSON NaN/Infinity;
- version/runtimeVersion divergentes de `3.1.3` e
  `policy=appVersion`;
- identidade Android alterada (`com.negresco.finance`, versionCode 34,
  `allowBackup=false`);
- `sdkVersion`, owner, plataformas e EAS projectId divergentes;
- `updates.enabled`, checkAutomatically ou fallback alterados;
- URL Expo nao fixada em
  `https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95`;
- canal diferente de `preview`, headers extras ou
  qualquer chave de assinatura OTA inserida em `updates`.

O job `verify-downloaded-ota-runtime` executa o Python inline
pertencente ao workflow, depois da checagem SHA-256, assinatura
Android, runtimeVersion e manifesto preview. Nao faz checkout.

`tests/android-downloaded-expo-config-consistency.test.mjs`
executa o codigo real em fixtures adversariais e valida sua
identidade byte a byte com o auditor embutido no workflow.

## Limites e risco residual

Esse gate confirma a coerencia de **duas representacoes**
independentes da politica OTA de laboratorio (manifesto compilado e
`assets/app.config`). Ele NAO prova assinatura OTA remota, nem
audita o binario Hermes executado pelo app. O app `preview`
continua com OTA sem assinatura de codigo, o que nao e
aceitavel como homologacao de release estavel. A origem da
distribuicao e a cadeia de dependencias tambem precisam ser
analisadas separadamente.

O publicador permanece SKIPPED e requer habilitacao manual,
politica de certificados e revisao antes de merge/release.
