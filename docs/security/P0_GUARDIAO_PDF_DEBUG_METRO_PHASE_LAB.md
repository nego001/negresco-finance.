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
