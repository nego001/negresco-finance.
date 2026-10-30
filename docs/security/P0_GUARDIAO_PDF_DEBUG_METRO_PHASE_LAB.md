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

## Categorização fechada da tela de inicialização (HEAD posterior ao bdb4fef)

O [workflow #41005688734](https://github.com/nego001/negresco-finance./actions/runs/41005688734) **terminou em FAILURE**. O Metro iniciou, o bundle Android Debug foi realmente entregue localmente (`STAGE (LAB): private Android Debug JS bundle served locally`), o `adb reverse` estava configurado, e o processo Android do app estava ativo e no foreground. Mesmo após a espera limitada, o texto `Seu universo` não ficou visível. Não houve navegação para Guardião, marcador Debug de PDF ou compartilhamento.

A nova classificação observa, **somente após a falha do teste de UI**, os nós retornados pelo parser in-memory existente e responde apenas com uma categoria de vocabulário fechado: `local-lock-loading/error/protected`, `js-bundle-load-error`, `js-dev-server-error`, `expo-development-screen`, `react-native-debug-screen`, `react-native-error-screen`, `no-recognized-boot-label` ou `ui-inspection-unavailable`. Nenhum texto do app, campos financeiros, XML, screenshot, stacktrace ou mídia é enviado. Não realiza taps em diálogos de permissão, erro, autenticação ou desenvolvimento; não desbloqueia a biometria. Os testes da categorização usam apenas strings sintéticas.

Uma categoria indica indício do estado visível, não causa-raiz. Não se altera a política de não publicar APKs, a lista de permissões vedadas, o APK Release pinado, a `main` ou qualquer backend.

## Hipótese forte: bloqueio HTTP do Metro pela política nativa

[Android Debug #41061263347](https://github.com/nego001/negresco-finance./actions/runs/41061263347) encerrou `FAILURE` após validar APK, receptor, Metro, pré-aquecer bundle JavaScript, instalar e iniciar o aplicativo. A análise categórica de UI confirmou `js-bundle-load-error`, mas o processo do app e o Metro continuaram vivos. Não houve nenhuma tentativa de PDF.

O plugin original `apps/mobile/plugins/withNegrescoNetworkPolicy.js` impõe `base-config cleartextTrafficPermitted="false"` e `android:usesCleartextTraffic=false` em **todas** as variantes. No Android 9, isso também pode bloquear o HTTP local necessário para carregar bundles React Native no build Debug. A entrega de JavaScript no host não demonstra que o app no emulador consegue lê-lo.

O novo arquivo `tooling/android/guardiao_debug_loopback_policy.py` acrescenta, **após o prebuild e apenas na árvore de saída temporária** `android/app/src/debug/res/xml/negresco_network_security.xml`, uma sobreposição de recurso Gradle com `base-config cleartextTrafficPermitted="false"` e exceção estreita para `localhost`, `127.0.0.1` e `10.0.2.2`. Não usa wildcard, subdomínios, CAs de usuário ou política global permissiva. Mantém nome do recurso já referenciado pelo AndroidManifest principal e não toca nesse manifesto ou no arquivo Release `src/main/res/xml/negresco_network_security.xml`.

O laboratório **verifica novamente o APK Debug empacotado**, lendo a representação binária do recurso com `aapt dump xmltree` e exigindo exatamente as exceções locais e padrão global falso. Qualquer ambiguidade bloqueia. O gate das quatro permissões negadas, assinatura SHA e isolamento sintético continuam. Nenhum recurso Debug é enviado ou publicado. A causa-raiz do PDF #120 segue desconhecida até teste end-to-end real.

Base normativa: Android Network Security Configuration `base-config` e `domain-config` conforme documentação oficial do Android. O Android 9 não dispõe da exceção localhost implícita que só foi introduzida muito depois.

## Diagnóstico do transporte Android ↔ Metro, sem alterar rede

No [workflow Android Debug #41063983807](https://github.com/nego001/negresco-finance./actions/runs/41063983807), a política de cleartext **restrita ao Debug** passou na auditoria do APK empacotado, mas o emulador continuou com categoria `js-bundle-load-error`. A causa da falha de carregamento ainda **não** está comprovada. O app nunca chegou ao Guardião/PDF.

O novo diagnóstico consulta exclusivamente `adb reverse --list` e, se houver mapeamento `tcp:8081`, solicita com `toybox nc` o endpoint literal `/status` no **loopback do próprio Android, 127.0.0.1:8081**, que deve responder apenas o marcador fixo `packager-status:running`. A saída bruta é processada apenas em memória e nunca impressa. O resultado é uma entre quatro categorias: `adb-reverse-not-confirmed`, `device-local-metro-reachable`, `device-status-probe-unconfirmed` e `device-status-probe-unavailable`. A ausência do utilitário `nc` em determinada imagem Android é tratada como **inconclusiva**, não como falha de rede.

A medição ocorre duas vezes: **antes de abrir o app**, após o `adb reverse`, e **após a falha de carregamento**, quando o teste de UI original já desativou `wifi` e dados celulares. Isso poderá separar uma perda de transporte após a desativação de rádio de uma falha própria de RN/debug host. Nenhuma regra de egress foi relaxada; não são ativados Wi-Fi, dados móveis, pagamentos, OTA nem acessos remotos.

A hipótese de que desligar wifi/dados interrompe o caminho de rede RN **permanece não testada**; a instrução `svc wifi disable` e `svc data disable` foi preservada neste commit. A política do app e o APK Release seguem inalterados. Um PASS da prova HTTP de loopback não demonstra que a aplicação consumiu o bundle nem que o PDF funciona.
