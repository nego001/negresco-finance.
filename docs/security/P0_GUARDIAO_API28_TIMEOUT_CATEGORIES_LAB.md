# Guardião P0 | Categorias de timeout no Android 9 (laboratório)

## Motivação

A [issue #120](https://github.com/nego001/negresco-finance./issues/120) documenta um timeout de exportação de PDF no Android 9/API 28 e sucesso com o **mesmo APK** na segunda tentativa do [workflow #40808040078](https://github.com/nego001/negresco-finance./actions/runs/40808040078).

O APK do laboratório é fixado pelo SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`. Não foi reconstruído ou alterado. A UI `Gerando PDF local...` não diferencia qual das Promises `Print.printToFileAsync`, `Sharing.isAvailableAsync` ou `Sharing.shareAsync` está pendente.

## Mudança restrita

Somente na ocorrência de timeout, o runner de laboratório combina os estados booleanos já filtrados da UI com as categorias já existentes de foco e processo. Produz um código fixo: `app-not-running`, `chooser-focus-unverified`, `ui-loading-app-foreground`, `ui-loading-focus-uncertain`, `visible-failure-no-chooser` ou `unclassified`.

**Importante:** `ui-loading-app-foreground` não prova que Expo Print travou; `chooser-focus-unverified` não prova PDF compartilhado. O teste continua retornando erro. Somente receptor independente, PDF sintético semanticamente verificado, limpeza de cache e gate pós-upload podem comprovar PASS da execução.

Os contratos cobrem casos sintéticos válidos e inválidos, verificam que a categoria não inclui dados inesperados e bloqueiam etapas de publicação. Nenhum logcat bruto, XML, PDF, captura, URI, HTML, dado bancário ou exceção nativa é emitido. Esta branch é empilhada sobre a PR #118 para preservá-la aprovada.

## Gates

- [ ] Testes de contrato no HEAD desta branch
- [ ] Emuladores Android 8/9 e gate pós-upload no novo HEAD
- [ ] Investigação da causa-raiz na issue #120; não presumir correção funcional
- [ ] Dispositivos físicos, auditoria de APK novo e revisão humana antes de produção

`approvedForProduction=false`, `stableReleaseAllowed=false`. Sem merge na `main`, release, OTA, APK de produção, transações ou dados financeiros reais.
