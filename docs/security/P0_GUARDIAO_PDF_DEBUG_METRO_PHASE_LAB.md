# Guardião | Teste Android Debug com Metro local, apenas cenário sintético

## Propósito

O APK compilado por `assembleRelease` na PR #123 tem os rótulos `[LAB:` removidos. Isso é correto para Release, mas não testa a instrumentação `__DEV__` da [PR #122](https://github.com/nego001/negresco-finance./pull/122).

Esta experiência, separada e não publicável, compila **um APK Debug novo**, assinado exclusivamente para teste, verifica permissões e identidade por SHA-256 dentro de um runner efêmero, inicia Metro **local e offline** e utiliza `adb reverse` num emulador Android 9/API 28. Nenhum APK Debug, PDF, screenshot, HTML, código JS, conteúdo de entrada ou logcat é enviado como artefato.

## Evidências exigidas

- Confirmação de processo Metro local em `127.0.0.1:8081` antes de iniciar o aplicativo.
- APK Android Debug do commit da branch, de tamanho limitado, sem links, com assinatura válida, `application-debuggable` e sem as permissões de overlay, armazenamento e mídia listadas na política.
- Reuso do fluxo real do Guardião: **referência de arrecadação inválida de 48 dígitos e apenas sintética**, análise inválida observada, toque no botão PDF, chooser real, receptor independente, renderização de todas as páginas, extração semântica em memória e limpeza.
- A rotina intercepta somente **booleans allowlisted** de UI e exige que pelo menos um dos rótulos Debug fixos (`lab-print-pending`, `lab-availability-pending`, `lab-share-pending`) tenha sido observado durante o fluxo. Um resultado verde sem marcador não serve como prova.
- O relatório sintético é verificado localmente e apagado. Nenhum upload nem release.

## Limitações

Uma única execução bem-sucedida **não reproduz o timeout intermitente** da issue #120 e não identifica sua causa-raiz. A categoria de etapa indica o último await iniciado pelo JavaScript, não o estado interno do módulo Android. A leitura de UI pode perder rótulos transitórios, levando a BLOCK conservador.

O workflow tem escopo apenas à branch `lab/p01-guardiao-debug-metro-phase-v1`, sem workflow_dispatch, tokens de escrita ou segredos. A `main`, os APKs de Release SHA-pinados, PRs anteriores, assinaturas de produção, Expo OTA e dados financeiros reais não são alterados.

## Debug manifest policy fix following blocked CI

[First Debug workflow #40993013998](https://github.com/nego001/negresco-finance./actions/runs/40993013998) compiled the APK successfully but correctly failed **before installing on the emulator**, after `aapt dump permissions` observed at least one denied permission. The original log did not identify which one. It would be incorrect to claim Android/PDF succeeded or to relax the final gate.

The regenerated `android/app/src/debug/AndroidManifest.xml` (temporary CI only) now removes any explicit prohibited declaration and adds high-priority Android merger `tools:node="remove"` directives for exactly four denied permissions. The assembled APK is still audited using `aapt` and blocked if **any** forbidden permission remains. The policy now reports only the static denied permission name, not XML, private paths or app content. Tests cover idempotence, missing/malformed/symlinked XML, preservation of an unrelated permission, and ordering before the actual build/permission verification.

**Not a blanket security exception:** the patch does not modify source `app.json`, Release signing/policies, production permission requirements, or apps on user devices. Metro, UI, PDF and the original Android 9 timeout remain unproven until the workflow actually reaches the emulated application.

## Falha do Metro e correção do conflito de opções CLI

A execução [#40996654568](https://github.com/nego001/negresco-finance./actions/runs/40996654568) confirmou: assinatura, integridade e permissões do APK Debug passaram, assim como o receptor externo e a inicialização do emulador API 28. O fluxo **não entrou no Guardião**: parou com a mensagem fixa `BLOCK STAGE (LAB): private Metro exited before local readiness` aproximadamente um segundo após iniciar Metro. Isso **não é** prova de defeito do PDF ou do Expo Print.

A análise do código do Expo CLI identificou um **conflito de argumentos**: `--offline` e `--localhost` não podem ser fornecidos juntos porque ambos controlam o modo de hospedagem. O laboratório agora inicia `npx expo start --localhost --port 8081`, mantendo `EXPO_OFFLINE=1` e `EXPO_NO_TELEMETRY=1` no ambiente. Assim, a escolha de interface permanece localhost e não são solicitadas consultas remotas. O teste de contrato falha se o conjunto conflitante de flags voltar. Não foi exposto stdout/stderr do Metro, HTML, PDF, token nem dado de cliente.

Referência técnica: `expo/expo/packages/@expo/cli/src/start/resolveOptions.ts`, função `resolveHostType`: recusa mais de uma das opções `--offline`, `--host`, `--tunnel`, `--lan`, `--localhost`.

**A correção é de inicialização do ambiente de testes**, não da intermitência original de Android 9. Nenhuma aprovação de produção ou mudança no APK pinado é inferida. Novo workflow real precisa passar com esse commit antes de reivindicar execução de PDF.

## Preparar bundle JavaScript antes de abrir a interface

A execução [Android Debug #40998077817](https://github.com/nego001/negresco-finance./actions/runs/40998077817) concluiu **FAILURE** após validar assinatura, quatro permissões, APK Debug, Metro em `localhost`, `adb reverse`, receptor independente e início real do processo do aplicativo no Android 9. O Android reportou `appProcessAlive=true` e `foregroundCategory=negresco-app`, mas **não foi encontrado o rótulo de home `Seu universo` dentro do prazo**. Nenhuma navegação para Guardião, chooser ou PDF ocorreu.

Para separar atraso/falha de bundle de problemas de UI, a nova etapa `prewarm_android_bundle` solicita **somente em 127.0.0.1:8081** o bundle de desenvolvimento `node_modules/expo/AppEntry.bundle?platform=android&dev=true&minify=false` antes de instalar/iniciar o aplicativo. Exige HTTP 200, resposta JavaScript e ao menos um byte, sem armazenar, imprimir, extrair, exportar ou publicar JS. A conexão local tem timeout limitado e a etapa **falha** sem fazer teste de PDF caso o bundle não esteja disponível. Se a interface ainda não aparecer, o runner imprime apenas `private Metro process alive/exited` e as categorias já aprovadas de atividade/processo.

O pré-aquecimento por si só não confirma que o app consumiu ou executou o bundle no emulador. A issue #120 permanece aberta e nenhuma hipótese de correção do PDF foi adotada.
