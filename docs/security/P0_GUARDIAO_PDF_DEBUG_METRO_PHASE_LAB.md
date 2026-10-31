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

## Classificação nativa restrita do bloqueio Debug

[Android Debug #41072264815](https://github.com/nego001/negresco-finance./actions/runs/41072264815) terminou com `js-bundle-load-error` mesmo com Metro vivo, JS servido no host e regras Debug de cleartext restritas. O teste simples de transporte interno retornou `device-status-probe-unconfirmed` **antes e após** a execução. Isso não prova perda de rede, pois a ferramenta `toybox nc` pode ser incompatível com a imagem API 28. O aplicativo não chegou à tela inicial nem ao PDF. CI push e PR do HEAD anterior concluíram **SUCCESS** (PR 9/9; 1.272/1.272 contratos).

O próximo diagnóstico, **somente após a falha de inicialização**, consulta a declaração de permissão `android.permission.INTERNET` do próprio APK instalado por `dumpsys package` e um extrato **limitado a 240 linhas** de mensagens nativas com tags fixas do subsistema React Native e AndroidRuntime. Tudo fica **somente na memória do runner efêmero**: não há impressão, armazenamento, upload ou exportação dos logs, nomes de classes, mensagens, URLs, campos ou dados. O classificador emite apenas categorias fixas, incluindo `native-cleartext-denied`, `native-internet-permission-denied`, `native-connection-refused`, `native-connection-timeout`, `native-js-bundle-load-error`, `native-js-runtime-error` e `native-startup-unconfirmed`.

Uma categoria é uma observação parcial, nunca declaração automática de causa-raiz. Não se altera o binário de produção, a política de rede, rádio, token, liberação biométrica ou a assinatura. A issue #120 permanece OPEN.

## Captura precoce de categorias de boot (sem dados brutos)

No [workflow Android Debug #41124944301](https://github.com/nego001/negresco-finance./actions/runs/41124944301) o APK Debug, recursos de rede locais, SHA, assinatura, Metro, Android 9 e receptor independente passaram. O app ficou aberto, mas a home não apareceu e a UI reportou `js-bundle-load-error`. A permissão `android.permission.INTERNET` foi confirmada **concedida**. O diagnóstico nativo após toda a espera retornou `native-startup-unconfirmed`, possivelmente porque um evento inicial deixou de estar nas últimas 240 linhas filtradas. Nenhum PDF foi iniciado.

A nova mudança **limpa apenas o buffer do emulador descartável antes da tentativa** e divide a busca já existente por `Seu universo` em uma primeira janela limitada a oito tentativas e o restante do prazo original. Após a primeira janela sem home, coleta apenas as categorias de `INTERNET` e erro nativo, sem imprimir nem armazenar texto de log, XML, PDF, stack, JavaScript, URI ou dados pessoais. Continua esperando a home pelo prazo restante sem interagir com diálogos, autenticação ou controles desconhecidos. Acrescenta apenas tags nativas selecionadas (`DevServerHelper`, `BundleDownloader`, `Expo`, `ExpoUpdates`) ao filtro já limitado a 240 linhas.

Os testes de contrato verificam o checkpoint inicial, a restauração do observador original e a preservação da janela de espera. A coleta nativa é somente em memória de CI, independente de backend. A issue #120 segue aberta; testes funcionais do PDF não podem ser declarados aprovados.

## Relay privado de transporte do bundle (diagnóstico, sem mudança de app)

A execução [Android Debug #41128737871](https://github.com/nego001/negresco-finance./actions/runs/41128737871), HEAD `c9c1a05`, terminou **FAILURE**: o APK Debug, o Metro no host, o pré-aquecimento do bundle e o emulador API 28 passaram, mas a home nunca ficou visível. O diagnóstico da UI foi `js-bundle-load-error`; a permissão INTERNET estava concedida e os dois checkpoints nativos retornaram `native-startup-unconfirmed`. Não houve teste do Guardião nem geração de PDF. As duas CIs de contratos desse HEAD terminaram **SUCCESS**.

A investigação seguinte adiciona `guardiao_debug_metro_transport_probe.py`, um relay exclusivo do runner de laboratório. O `adb reverse tcp:8081` do emulador aponta para um socket local `127.0.0.1:18081`, que retransmite bytes somente ao Metro já existente em `127.0.0.1:8081`. Não abre listener externo, não modifica o APK nem o tráfego lógico, e preserva o rádio desligado, a política de cleartext limitada a Debug, a validação SHA e todas as proibições de produção. O relay recebe tráfego exclusivamente sintético do emulador descartável. Os bytes trafegam em memória, sem escrita de solicitações, respostas, URLs, cabeçalhos, JavaScript ou informações privadas em log ou artefato.

O observador retém apenas contadores e flags agregados e emite uma **categoria fixa**: `device-no-metro-connection-observed`, `device-metro-connection-without-bundle`, `device-debug-bundle-response-unconfirmed`, `device-debug-bundle-http-non200` ou `device-debug-bundle-http-200`. Apenas o primeiro status HTTP de solicitações de formato `.bundle` é inspecionado, sem armazenar o caminho ou conteúdo. O GET de pré-aquecimento no host é anterior ao relay e não pode ser confundido com um pedido do dispositivo.

A observação de HTTP 200 prova no máximo que um pacote HTTP chegou ao transporte local, **não** que o React Native executou JavaScript ou que o PDF funciona. A ausência de pedido de bundle aponta para investigar host/rota, mas não é prova isolada de erro de endereço. A issue #120 continua OPEN; PR #125 permanece Draft. A nova CI no HEAD ainda precisa concluir para validar esse instrumento de diagnóstico.

## Execução #41156862811: separar pré-teste HTTP de tráfego do app

O HEAD `5650eff88247039abed4cfa45882f3ee360fc165` concluiu com **SUCCESS** em ambas CIs gerais ([push #41156862795](https://github.com/nego001/negresco-finance./actions/runs/41156862795) e [PR #41156867226](https://github.com/nego001/negresco-finance./actions/runs/41156867226), esta com 9/9 jobs aprovados). Porém, o [Android Debug #41156862811](https://github.com/nego001/negresco-finance./actions/runs/41156862811), job `124405611555`, concluiu **FAILURE** em `Exercise actual Debug-only phase markers, real chooser and synthetic PDF`. APK Debug, SHA, manifesto/permissões, receptor independente, emulador 28, Metro e pré-aquecimento do bundle passaram. O app lançou e seu processo permaneceu em primeiro plano, mas a home não apareceu. A UI foi classificada como `js-bundle-load-error`, a permissão INTERNET estava concedida, e os checkpoints nativos permaneceram inconclusivos. **Não houve navegação para Guardião nem impressão, chooser ou validação PDF.**

O relay registrou `device-metro-connection-without-bundle`. A investigação estática identificou um viés de medição: `report_android_local_metro("before-app")` pode enviar `GET /status` via `toybox nc` antes do início do app; isso pode ter contado como conexão no relay. O status de pré-teste foi `device-status-probe-unconfirmed`, portanto não confirma nem descarta que a conexão observada tenha sido originada pelo probe. O resultado **não é prova de solicitação do app**.

A correção posterior redefine as observações do relay **depois** do probe anterior ao app e **antes** de `semantic.run_lab()`. Cada conexão tem um identificador de geração, de modo que requisições ou respostas atrasadas de sockets aceitos antes da redefinição são ignoradas nas métricas da nova geração. As categorias separam `device-http-request-without-bundle` (requisição HTTP reconhecida sem bundle) de `device-tcp-only-no-http-observed` (apenas socket observado), além dos estados de bundle HTTP e ausência de conexão. Não são registrados tráfego bruto, URL, JavaScript, stack, campos financeiros ou conteúdo de PDF.

**Limites:** somente o primeiro request HTTP de cada socket é classificado, e conexões usando `10.0.2.2:8081` diretamente podem não atravessar o relay da regra `adb reverse`. Por isso ausência de bundle observável não identifica por si só a causa de falha RN. A nova execução Android ainda precisa confirmar esse instrumento. PR #125 segue Draft, issue #120 aberta e nenhuma alteração na `main`, OTA, assinatura ou pagamento real.

## API 28: transporte ausente no relay depois de descartar o preflight

No HEAD `01c6e51`, a [CI de push #41159332556](https://github.com/nego001/negresco-finance./actions/runs/41159332556) e a [CI da PR #41159336603](https://github.com/nego001/negresco-finance./actions/runs/41159336603) concluíram **SUCCESS** (esta com 9/9 jobs). O [teste Android Debug #41159332586](https://github.com/nego001/negresco-finance./actions/runs/41159332586), job `124413476351`, concluiu **FAILURE** na etapa funcional. Build Debug, SHA, assinatura, permissão INTERNET, política HTTP apenas loopback, Metro e pré-aquecimento do bundle no host passaram. O processo do app estava vivo e em primeiro plano, porém a home não apareceu e a UI foi categorizada como `js-bundle-load-error`. O novo relay pós-preflight registrou `device-no-metro-connection-observed`. Nenhum teste de Guardião, chooser ou PDF ocorreu.

A interpretação é restrita: o relay recebe apenas conexões encaminhadas por `adb reverse tcp:8081 tcp:18081`. O Android Emulator disponibiliza `10.0.2.2` como alias para o loopback do computador hospedeiro, rota que não precisa passar pelo relay. Portanto a ausência de conexões observadas **não comprova que o React Native não tentou carregar o bundle**.

O próximo diagnóstico, restrito à PR experimental e executado **somente após falha funcional**, compara duas rotas de teste estáticas do emulador para o endpoint local `/status`: `127.0.0.1:8081` (via `adb reverse`) e `10.0.2.2:8081` (alias do hospedeiro). Também observa o valor de `getprop metro.host` e o reduz a uma categoria fixa, sem exibir o valor bruto nem hosts desconhecidos. Todos os comandos têm timeout e saída limitada em memória; nenhum conteúdo HTTP, XML, JavaScript, URI, exceção, logcat, screenshot, PDF ou dado financeiro é publicado.

Os resultados permitidos para cada rota são `metro-status-reachable`, `route-unconfirmed` ou `probe-tool-unavailable`. O uso de `toybox nc` pode falhar na imagem Android 9, portanto qualquer resultado inconclusivo permanece inconclusivo. Mesmo com duas rotas acessíveis, isso não prova que o aplicativo usou uma delas ou executou JavaScript. O diagnóstico não modifica rede, rádio, configurações do dispositivo, aplicativo ou política de Release. A issue #120 segue OPEN; a PR #125 segue DRAFT e sem merge.
