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

## Verificação local de rotas sem `toybox nc` (API 28)

A [CI push #41161749551](https://github.com/nego001/negresco-finance./actions/runs/41161749551) e a [CI PR #41161752685](https://github.com/nego001/negresco-finance./actions/runs/41161752685) do HEAD `79e23b0` concluíram **SUCCESS**; a CI da PR concluiu 9/9 jobs. O [workflow Android #41161749560](https://github.com/nego001/negresco-finance./actions/runs/41161749560), job `124420727823`, concluiu **FAILURE** no gate funcional de Android 9. APK, Metro, pré-aquecimento JS, instalação e processo em foreground passaram, mas a home ficou ausente com categoria `js-bundle-load-error`, INTERNET concedida e `device-no-metro-connection-observed`. No diagnóstico de rotas, `getprop metro.host` retornou `metro-host-property-unset` e **as duas rotas retornaram `probe-tool-unavailable`** porque a imagem Android não disponibiliza o `toybox nc` necessário. Nenhum PDF, chooser ou fluxo Guardião foi exercitado.

A atualização seguinte acrescenta `guardiao_debug_metro_app_process_probe.py` **apenas no laboratório Debug descartável**. Após a falha da tela inicial, o runner usa `javac` e o `d8` já instalado no SDK para montar, numa pasta temporária, uma pequena classe Java estática como DEX de diagnóstico. O arquivo é enviado a `/data/local/tmp/negresco-metro-route-lab.jar` do emulador e executado por `app_process` sob o **UID de shell**, sem criar ou modificar APK, sem privilégios de root, sem mexer nas preferências do React Native e sem alterar o binário do Negresco. Uma cláusula `finally` apaga o arquivo no dispositivo; a pasta temporária do runner é removida ao final.

A classe consulta exclusivamente `/status` nas rotas **fixas de desenvolvimento local** `127.0.0.1:8081` e `10.0.2.2:8081`, com timeouts e limite de bytes. O único resultado emitido para cada rota é `shell-metro-status-reachable`, `shell-route-unconfirmed` ou `shell-probe-unavailable`. Nenhuma resposta HTTP, cabeçalho, conteúdo JS, exceção, URL de usuário, logcat ou dado financeiro é impresso, registrado ou exportado. Os testes de contrato cobrem a rejeição de saída diferente das categorias permitidas, limitação dos destinos, limpeza do DEX e a execução após o bloqueio funcional.

**Limitação essencial:** `app_process` roda como **shell**, e não como `com.negresco.finance`. Uma rota acessível pela ferramenta comprova apenas a conectividade local desse processo de teste. **Não comprova conectividade do UID da aplicação**, escolha efetiva de host do React Native, execução do JS ou funcionalidade do PDF. `metro.host` também não representa necessariamente a configuração efetiva (possível preferência Dev Settings). O teste não afrouxa a política de produção, não envia dados remotos e não altera o estado da issue #120. PR #125 permanece Draft e com homologação bloqueada.

## Comparação antes/depois do desligamento de rádio do Android 9

No HEAD anterior `ab7419ae`, a [CI push #41163160463](https://github.com/nego001/negresco-finance./actions/runs/41163160463) e a [CI PR #41163163037](https://github.com/nego001/negresco-finance./actions/runs/41163163037) concluíram **SUCCESS**, esta com 9/9 jobs aprovados. O [laboratório Android Debug #41163160480](https://github.com/nego001/negresco-finance./actions/runs/41163160480), job `124425166751`, concluiu **FAILURE**: instalou e lançou o APK, mas a home ficou ausente com `js-bundle-load-error`. O bundle foi servido apenas no host; o relay observou `device-no-metro-connection-observed`; `getprop metro.host` ficou unset; `toybox nc` indisponível; o diagnóstico Java executado após a falha retornou duas categorias `shell-route-unconfirmed`. **Sem prova de acesso do app ao Metro nem do PDF.**

A revisão do teste encontrou uma hipótese causal concreta, mas ainda não confirmada: `guardiao_pdf_ui_emulator_smoke.py` foi concebido para APK Release offline e executa `svc wifi disable` e `svc data disable` **antes de instalar e iniciar o APK**. Já o laboratório atual instala uma versão **Debug que precisa obter o bundle JavaScript do Metro** no host. Esse desligamento pode interferir no alias `10.0.2.2` do emulador, mesmo com o Metro funcionando no runner; uma rota `adb reverse` pode ter comportamento diferente. Não é seguro concluir causa-raiz com apenas medições posteriores à desativação dos rádios.

A atualização seguinte mantém o rádio DESLIGADO no teste principal e preserva todos os gates existentes, mas adiciona uma medição controlada e estritamente categórica da conectividade **antes de** `semantic.run_lab()` desligar Wi-Fi/dados. A mesma ferramenta Java em UID `shell` realiza o teste novamente **após a falha da home**, gerando pares `before-radio-disable shell loopback/alias` e `Android Debug shell loopback/alias`. Os dois testes consultam somente `/status` nas rotas locais fixas `127.0.0.1:8081` e `10.0.2.2:8081`, sem saída HTTP, JavaScript, logcat, XML ou dados financeiros. O relay é resetado **depois** da medição inicial para impedir que a conexão de diagnóstico seja confundida com a conexão do app.

Também foi corrigida uma ambiguidade na classificação: saída inválida ou ausente de `app_process` agora retorna `shell-probe-unavailable`, **não** `shell-route-unconfirmed`. Um `shell-route-unconfirmed` agora só surge se o Java executar e devolver categorias esperadas sem resposta Metro confirmada. Testes sintéticos exercitam ambas as distinções.

**Inferência permitida:** se uma rota responder antes e não responder depois de `svc wifi/data disable`, isso é evidência de impacto de rede **para o processo shell**, não automaticamente para o UID/host efetivo do React Native. Se os dois momentos forem inconclusivos, continuar a investigação sem alterar o Debug ou afirmar que o PDF foi reparado. PR #125 Draft, issue #120 OPEN; sem merge, liberação Release/OTA ou pagamento real.

## Ensaio Debug com rádio preservado e correção dos contratos (HEAD posterior a `1c13351`)

No HEAD `1c13351`, as duas CIs gerais [push #41172425793](https://github.com/nego001/negresco-finance./actions/runs/41172425793) e [PR #41172428944](https://github.com/nego001/negresco-finance./actions/runs/41172428944) concluíram **FAILURE** exclusivamente no job `contracts`: **1.279/1.281** cenários aprovados; duas asserções estáticas falharam por motivos de manutenção do teste. A primeira exigia que a limpeza do relay estivesse a até 350 caracteres da etapa `before-app`, sem considerar o novo probe inicial legítimo. A segunda proibia literalmente a substring `requests.` em qualquer lugar do runner, inclusive na observação em comentário `app requests.`. Os contratos foram corrigidos para verificar **ordem efetiva** (`before-app` antes de `relay.reset_after_preflight()` antes de `semantic.run_lab()`) e proibir **chamadas reais** a clientes HTTP externos, sem falso positivo em comentários. Isso não equivale a dispensar os requisitos de segurança.

O [Android Debug #41172425600](https://github.com/nego001/negresco-finance./actions/runs/41172425600), job `124453037145`, concluiu FAILURE: o APK Debug e o Metro local passaram, mas a home continuou ausente com `js-bundle-load-error` e `device-no-metro-connection-observed`. O Java de diagnóstico retornou `shell-probe-unavailable` **tanto antes quanto depois** da desativação de rádio. Logo, essa execução **não avaliou a hipótese de conectividade** e não testou o PDF.

### Experimento de isolamento somente para o APK Debug

A atualização seguinte introduz um interceptador **em memória e apenas no runner `guardiao_pdf_debug_metro_lab.py`** para preservar a rede local do emulador enquanto o APK Debug precisa baixar JS do Metro. O interceptador captura exclusivamente duas chamadas literais do smoke legado: `adb("shell", "svc", "wifi", "disable", check=False)` e `adb("shell", "svc", "data", "disable", check=False)`; todas as demais chamadas passam ao ADB real, e uma chamada inesperada de desligamento de rádio provoca falha explícita. O runner exige a observação **de ambas** as chamadas esperadas antes de considerar o experimento completo. Os hooks de ADB, espera da UI e chooser são restaurados em `finally`.

**O smoke original de Release não foi alterado:** continua desligando Wi-Fi e dados móveis. O experimento é exclusivamente Debug, efêmero, em branch `lab/`, com `EXPO_OFFLINE=1`, Metro `--localhost`, fixture de boleto propositalmente inválida e sem credenciais ou permissões de publicação. Ele não prova ausência de todo e qualquer egress HTTPS do app, nem representa uma liberação de rede em produção. A política de segurança do APK e os bloqueios de pagamento permanecem. O objetivo é separar a condição do APK Debug, que exige bundle hospedado, da condição do teste Release, que não exige Metro.

**Critério de resultado:** sucesso na home e no fluxo Guardião/PDF exigirá observação independente das etapas e validação do PDF, chooser e limpeza. Mesmo uma tela inicial aberta não autoriza `approvedForProduction=true`, Release ou merge. Em caso de novo `js-bundle-load-error`, continuar investigação da origem do bundle e do bootstrap, sem inventar PASS. PR #125 permanece Draft, issue #120 aberta.

## Resultado das reexecuções: Release intermitente reproduzido e marcador Debug transitório

Os dois jobs foram reexecutados **sem mudar os respectivos commits** em 31/10/2026:

- [Release original #40808040078, tentativa 3](https://github.com/nego001/negresco-finance./actions/runs/40808040078), commit `767ceb17`, APK SHA-pinado inalterado: **FAILURE** no job **API28** `124604520513`. A home, o Guardião, a entrada inválida sintética e o toque real no botão PDF foram confirmados. Após o toque a UI permaneceu em `Gerando PDF local...`, com app em primeiro plano e sem chooser até o limite original de observação. O validador bloqueou o resultado sem recibo. O job **API26** `124604521746` foi **SUCCESS** (prova independente do PDF), e a etapa de revisão dos dois recibos foi pulada corretamente por ausência de prova API28. A tentativa 2 do mesmo workflow havia concluído SUCCESS para APIs 26/28; essa alternância sustenta a **intermitência real** do bug Release, sem identificar qual await nativo travou.
- [Debug #41200998769, tentativa 2](https://github.com/nego001/negresco-finance./actions/runs/41200998769), commit `cbccd293`: **FAILURE no gate de marcador**, **não** no fluxo de PDF. Logs confirmam home/Guardião, análise da entrada inválida, chooser real, receptor independente, PDF real, SHA, tamanho, renderização, semântica e limpeza com PASS. No entanto as capturas de `onPendingPhase` em UI não observaram um dos rótulos `[LAB: ... pendente]`; o runner bloqueou com `no actual debug-only pending-phase marker was observed`. A primeira tentativa no mesmo Debug havia registrado `lab-share-pending` e aprovado. A alternância demonstra **fragilidade da observação transitória**, não uma falha comprovada na geração do PDF na tentativa 2.

### Instrumento posterior somente `__DEV__`: última etapa iniciada

Uma alteração exclusivamente na branch laboratorial `apps/mobile/App.tsx` adiciona estado tipado `PdfExportPendingPhase|null` para a **última etapa PDF iniciada**. O observador `onPendingPhase`, após os mesmos gates de token, lock e foreground, registra apenas o enum fixo `print / availability / share`; o estado é reiniciado antes de cada exportação e exibido como texto de acessibilidade **somente quando `__DEV__`**. Nenhum valor de boleto, HTML, PDF, caminho, URI, stack ou exceção é retido. Ao contrário do rótulo temporal `pendente`, essa evidência persistente quer dizer apenas **a etapa JS foi iniciada em algum momento dessa tentativa**, nunca que o `await` nativo continua pendente.

O runner do Android 9 continua exigindo recibo íntegro e prova semântica independente, limpeza de cache e `approvedForProduction=false`; **somente depois** de `semantic.run_lab()` completar, se nenhuma observação transitória foi vista, ele volta do receptor externo com uma tecla Back e procura o texto fixo `LAB: última etapa PDF iniciada: share`. Se não encontrar nem essa observação, bloqueia do mesmo jeito. Os testes de contrato verificam a ordem, o escopo `__DEV__`, a ausência de espera artificial e a manutenção dos gates de PDF. O smoke Release original e o APK SHA-pinado continuam inalterados.

**Não se declara consertada a causa nativa do PDF Release.** O resultado do novo teste ainda depende de CI e emulador no novo HEAD. Para fechar a issue #120: diagnosticar o `await` responsável no Release sob intermitência, verificar repetibilidade Android 9 e Android 8, testar fisicamente e realizar revisão humana antes de uma decisão de produção. PR #125 segue DRAFT, issue #120 OPEN, sem merge, release, OTA ou operações financeiras reais.

## Execução do HEAD `8026edf`: falha da entrada sintética antes da exportação

As três execuções do HEAD `8026edf9066f3693725ff1a3cc252988bad5f514` foram consultadas e concluíram:
- [Mobile static check #41342977192](https://github.com/nego001/negresco-finance./actions/runs/41342977192): **SUCCESS**.
- [CI push #41342972587](https://github.com/nego001/negresco-finance./actions/runs/41342972587): **SUCCESS**, 1.285/1.285 contratos.
- [CI PR #41342977187](https://github.com/nego001/negresco-finance./actions/runs/41342977187): **SUCCESS**, 9/9 jobs e 1.285/1.285 contratos.
- [Android Debug #41342972588](https://github.com/nego001/negresco-finance./actions/runs/41342972588), job `124956751650`: **FAILURE**. Compilação/assinatura/manifesto/Metro/API28/instalação/launch passaram, a home foi observada, a navegação ao Guardião funcionou, e o rótulo do campo sintético apareceu. A execução terminou **antes** da etapa `synthetic field entered`, durante o preenchimento/verificação da entrada sintética, sem confirmação do valor no `EditText`. O runner de propósito oculta exceções e valores, portanto os logs **não identificam ainda se houve falha de toque, entrada vazia, valor divergente, XML temporariamente ausente ou outro bloqueio**. Nenhum toque no botão PDF nem teste do novo marcador persistente ocorreu nessa tentativa.

Esse resultado NÃO reproduz o travamento do PDF Release nem prova defeito do novo marcador; é um bloqueio anterior da automação Android Debug.

### Instrumentação seguinte sem mascarar falhas da automação

No runner exclusivamente Debug, a conferência do `EditText` de entrada sintética, chamada com `wait_visible("Linha digitável do boleto", retries=10)`, continua usando **a comparação original estrita** de `guardiao_pdf_ui_emulator_smoke.py`: `populated.get("text", "") == FIXTURE`. Quando essa conferência pode falhar, a branch experimental coleta uma segunda visão da UI em memória e emite apenas categoria fixa:
`synthetic-input-view-unconfirmed`, `synthetic-edittext-not-observed`, `synthetic-edittext-empty`, `synthetic-edittext-nonempty-mismatch` ou `synthetic-value-in-other-edittext`.

O classificador compara campos permitidos (`class`, `content-desc`, `text`) com a fixture artificial em memória, **sem publicar** texto, dígitos, XML, coordenadas, quantidade de caracteres ou hierarquia. Não reinjeta texto, não toca em botões, não altera o Release original nem permite PASS quando a validação da entrada falha. Testes sintéticos verificam as categorias, o allowlist do campo correto e o gate de igualdade ainda obrigatório.

O objetivo é distinguir uma falha de automação de um bloqueio funcional do PDF. **A próxima execução Android do novo HEAD ainda precisa validar a instrumentação.** PR #125 permanece Draft; issue #120 OPEN, APK Release SHA-pinado intocado, nenhuma aprovação de produção, OTA, merge ou pagamento real.

## Diagnóstico `synthetic-value-in-other-edittext`: automação selecionava rótulo antes do campo

A [execução Android Debug #41370673812](https://github.com/nego001/negresco-finance./actions/runs/41370673812), HEAD `8022f452`, encerrou **FAILURE** depois de o app, home, Guardião e rótulo da entrada sintética aparecerem. O classificador acrescentado na execução mostrou **`ENV (LAB): Android Debug synthetic input synthetic-value-in-other-edittext`**: o valor artificial correto estava presente em um `android.widget.EditText` cujo `content-desc` era exatamente `Linha digitável do boleto`, mas `wait_visible` retornara outro nó de UI com o rótulo visível. O smoke legado avalia `populated.get("text") == FIXTURE` no nó retornado, por isso bloqueou. A detecção *não* demonstra defeito na validação real do boleto ou no PDF; a falha foi antes do toque de exportação.

No mesmo HEAD, [CI push #41370678965](https://github.com/nego001/negresco-finance./actions/runs/41370678965), [CI PR #41370673793](https://github.com/nego001/negresco-finance./actions/runs/41370673793) e [Mobile static #41370678838](https://github.com/nego001/negresco-finance./actions/runs/41370678838) terminaram **SUCCESS**, com **1.287/1.287 contratos** em ambas as CIs (CI PR 9/9 jobs).

### Correção restrita à seleção da entrada sintética no Debug

A branch experimental acrescenta `select_verified_debug_synthetic_edittext`: apenas no ponto de confirmação da fixture artificial com `wait_visible("Linha digitável do boleto", retries=10)`, obtém em memória a árvore de acessibilidade do emulador e **retorna exclusivamente o único nó `android.widget.EditText` com `content-desc` exato e `text` exatamente igual aos 48 caracteres inválidos da fixture conhecida**. Se não houver nó exato, houver vários candidatos, classe/label errados, valor incompleto, discrepante ou incerto, retorna o nó original para que a **comparação rigorosa do smoke legado continue falhando**. Nenhum valor é impresso ou anexado; somente `synthetic-edittext-exact-verified` para a seleção inequívoca. Não digita novamente, não toca outro campo, não troca fixture, não ignora comparações ou aumenta prazos. O helper e sua seleção são usados **só no runner Debug**, sem tocar na automação ou APK Release da issue #120.

Contratos novos cobrem campo único correto, rótulo TextView, vazio, incompleto, duplicidade, classe/label incorretos, fixture diferente e manutenção do gate estrito. Ainda é necessário confirmar sucesso do teste Android **no novo HEAD**; contratos PASS não equivalem a PDF gerado.

**Escopo de segurança:** PR #125 Draft, issue P0 #120 aberta e com travamento Release intermitente reproduzido, APK Release original SHA-pinado intacto, `approvedForProduction=false`, `stableReleaseAllowed=false`, sem merge, assinatura, release/OTA, dinheiro real ou dados financeiros privados.

## Instrumentação de callbacks nativos do expo-print, somente Debug descartável

As duas tentativas do [Android Debug #41377374088](https://github.com/nego001/negresco-finance./actions/runs/41377374088), HEAD `cb029dc`, terminaram **SUCCESS**, assim como Mobile static, CI push e CI PR (1289/1289 contratos). Esse PASS ainda não corrige o [Release original intermitente, P0 #120](https://github.com/nego001/negresco-finance./issues/120).

O script `tooling/android/guardiao_pdf_native_phase_lab.py` injeta somente linhas constantes de fase na cópia `node_modules/expo-print` de um runner CI efêmero, após `npm install`/`expo prebuild` e antes de `assembleDebug`. Rejeita âncoras de SDK54 desconhecidas, fonte ausente e dupla aplicação. Ele **não** altera pacote-fonte versionado de produção, APK Release SHA-pinado, `main`, credenciais ou rede externa.

Eventos nativos allowlisted: `native-render-entered`, `native-webview-created`, `native-page-finished`, `native-layout-requested/finished/failed/cancelled`, `native-write-requested/finished/failed/cancelled`, `native-render-completed`. Coleta apenas as linhas da tag privada e retorna **a última categoria fixa**, ou `native-phase-unconfirmed`; nunca imprime logs brutos, conteúdo do PDF, dados do boleto, HTML, URIs, código ou exceções. Eventos não observados não provam ausência de callback; a categoria é auxílio diagnóstico, não substituto do recibo/semântica/limpeza PDF.

O app e o smoke Release originais não foram alterados. A instrumentação requer CI/Android reais no novo HEAD para comprovar compilação, fases e validade do PDF. PR #125 permanece DRAFT, issue #120 aberta, `approvedForProduction=false`, `stableReleaseAllowed=false`; sem merge, release/OTA ou transação financeira real.

## Diagnóstico da coleta Logcat, 02/11/2026

A [execução Android Debug #41450245450](https://github.com/nego001/negresco-finance./actions/runs/41450245450), HEAD `61f2400`, foi **SUCCESS**, com APK Debug instrumentado compilado, home/Guardião, chooser real, receptor PDF, SHA, semântica e cache limpo. A coleta retornou **`native-phase-unconfirmed`**, portanto **NENHUM callback nativo foi comprovado por esse mecanismo**. [CI push #41450245423](https://github.com/nego001/negresco-finance./actions/runs/41450245423) e [CI PR #41450255452](https://github.com/nego001/negresco-finance./actions/runs/41450255452) **SUCCESS**, 1.291/1.291 contratos.

Hipótese específica de *observabilidade*, não de defeito de impressão: o coletor original dependia do formato implícito de Logcat e de apenas 96 linhas. A consulta nova define explicitamente `-v tag`, limitada à tag experimental `NegrescoPdfPhaseLab:I`, retém somente a categoria final allowlisted e amplia o limite fixo de leitura para 512 linhas; a saída bruta nunca é salva nem impressa. O parser também reconhece os formatos tag, threadtime e brief (`I/Tag(PID)`), mantendo a correspondência da tag e dos eventos autorizados. A referência oficial Android descreve as diferenças: https://developer.android.com/tools/logcat.

Um preflight **separado**, usando `NegrescoPdfPhaseProbe`, escreve somente `lab-probe-` com nonce aleatório efêmero e tenta ler o mesmo identificador no Logcat. Somente `native-logcat-probe-confirmed` ou `native-logcat-probe-unconfirmed` aparece nos logs; o nonce nunca é exposto e esse preflight não conta como callback nativo, prova de PDF ou autorização. O preflight roda após o reset da janela nativa e antes da entrada sintética. Os testes de contrato cobrem formatos, rejeição de tags erradas e isolamento do probe.

**Limites:** o preflight não demonstra que a cópia instrumentada do `expo-print` foi a que efetivamente executou; mesmo com canary positivo, `native-phase-unconfirmed` exige continuar investigando o vínculo JNI/autolinking e a coleta. Não se declarou reparo do Release da issue #120. PR #125 Draft, sem merge/release/OTA/pagamentos reais.

## Verificação posterior: tags nativas no APK e checkpoint antes do receptor (HEAD após 9be1b72)

O [Debug/API28 #41485771697](https://github.com/nego001/negresco-finance./actions/runs/41485771697), HEAD `9be1b72`, terminou **FAILURE no gate visual**, **após PDF real PASS** (chooser, receptor independente, SHA, renderização, semântica e limpeza). O preflight `native-logcat-probe-confirmed` prova que o canal selecionado de Logcat funciona para a tag sintética, mas a coleta das fases do `expo-print` retornou `native-phase-unconfirmed`. Isso não prova que o callback não executou. A alternativa de voltar ao app e ler o marcador persistente de `share` também não foi observada. [CI push #41485771515](https://github.com/nego001/negresco-finance./actions/runs/41485771515) e [CI PR #41485783534](https://github.com/nego001/negresco-finance./actions/runs/41485783534) **SUCCESS**, 1.291/1.291 contratos e CI PR 9/9; [Mobile static #41485783471](https://github.com/nego001/negresco-finance./actions/runs/41485783471) PASS.

Para distinguir fontes de ausência de observação, o laboratório efêmero passa a conferir, **após build e após auditoria independente de SHA/permissões**, que o próprio APK Debug contém as strings fixas dos hooks Kotlin em `classes*.dex`. O validador de ZIP lê somente arquivos DEX com limite de tamanho/quantidade e emite exclusivamente PASS/BLOCK. Isso não prova execução efetiva desses métodos; apenas evita testar um APK que não contém a instrumentação compilada. Não publica DEX, APK, classe, código de cliente ou dados financeiros.

O executor agora consulta **uma única vez** a última categoria nativa assim que detecta o chooser Android real e antes de mudar para o receptor independente, registrando apenas `native-...` ou `native-phase-unconfirmed`. Repete a coleta final depois do receptor. A consulta pode distinguir descarte de buffers ou janela incorreta de ausência mais persistente, mas é apenas informativa. **Os critérios de PDF PASS continuam exigindo SHA, semântica, recibo e cache limpo; o gate de marcador visual JS continua FAIL-CLOSED**, sem aceitar um marcador nativo como substituto. Nada muda no Release SHA-pinado/CI original, `main`, OTA, pagamentos ou aprovações.

## 02/11/2026 | Auditoria DEX: descoberta de falha na cobertura multidex

No [Android #41492761642](https://github.com/nego001/negresco-finance./actions/runs/41492761642), HEAD `aa6a44e`, **BUILD SUCCESSFUL**, integridade/assinatura/permissões/política Debug **PASS**, mas o gate novo `verify-debug-apk` terminou **BLOCK antes de instalar o receptor e antes do teste PDF**. Não é prova de falha de PDF nem ausência inequívoca do hook. [CI push #41492761572](https://github.com/nego001/negresco-finance./actions/runs/41492761572), [CI PR #41492776065](https://github.com/nego001/negresco-finance./actions/runs/41492776065) **SUCCESS** (PR 9/9), 1.292/1.292 contratos; verificação estática **SUCCESS**.

Auditoria do verificador achou problema concreto: `DEX_NAMES` aceitava `classes.dex` e `classes2.dex` até `classes9.dex`, mas **excluía `classes10.dex` e superiores**. É possível que isso gere um falso negativo de presença de hooks. Não se afirma ainda que essa era a causa única do BLOCK; a etapa anterior não distinguia hipóteses. A regex foi corrigida para aceitar `classes10+`, e o gate agora emite **somente categoria fixa** entre APK indisponível, conjunto DEX não confirmado, tamanho inválido, cabeçalho inválido, nenhum hook observado, hooks parciais, hooks presentes ou inspeção indisponível. Continua bloqueando se faltam evidências. Testes sintéticos incluem classes10, tags parciais, arquivo inesperado, cabeçalho incorreto e a função booleana original. Não imprime DEX, nomes de classes, inputs, URI ou PDF.

**Próximo dado necessário:** reexecutar Android 9 para identificar a categoria do DEX real e, se hooks presentes, continuar ao checkpoint do chooser. Não declarar callback nativo culpado ou reparo Release sem evidência. Issue #120 OPEN, PR Draft, sem merge/release/OTA/pagamentos.
