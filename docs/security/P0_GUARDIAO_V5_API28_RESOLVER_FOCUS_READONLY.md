# P0 Android 9 — foco de janela após snapshot com sinal de resolvedor

## Evidência confirmada

A matriz de oito emuladores [#44148211865](https://github.com/nego001/negresco-finance./actions/runs/44148211865) terminou **7 PASS / 1 FAIL fechado**. O trial 5 comprovou o PDF A sintético por receptor independente. Na primeira leitura de acessibilidade antes do retorno Home, a árvore continha nós do pacote framework `android` com `resolver_list`, `contentPanel`, classe de lista e múltiplos nós clicáveis, sem as abas do app. Na segunda leitura (~1,2s depois), a árvore voltou ao app; a regra de duas leituras válidas recusou a navegação e não gerou PDF B. Isso é compatível com um resolvedor de seleção de aplicativo, não prova a Activity em foco.

A CI [#44149612087](https://github.com/nego001/negresco-finance./actions/runs/44149612087) do contrato que proíbe resolver→app passou por completo com **1533/1533 contratos**. As issues #120/#126 permanecem abertas.

## Nova etapa limitada: uma leitura de foco, só quando a anomalia já está presente

O novo wrapper intercepta o classificador já existente dos nós em memória e, **somente se** encontrou um marcador estrutural exato de resolvedor ou chooser no pacote `android`, solicita **uma** leitura read-only `adb shell dumpsys window windows`, com limite de 8 segundos e sem retry. O dump fica na memória da execução; o parser já auditado `safe_window_focus_category` retorna apenas `window-focus-app`, `window-focus-chooser`, `window-focus-ime-named`, `window-focus-other`, `window-focus-null` ou `window-focus-unconfirmed`. Sem marcador, **zero leituras novas**. Se o comando falhar, classificação `unconfirmed`, sem transformar em PASS.

**A coleta do foco acontece imediatamente depois da classificação do snapshot, mas NÃO É ATÔMICA com o dump UIAutomator**. O foco pode ter mudado entre os dois momentos; registrar uma categoria `window-focus-app` não invalida a árvore anterior nem justifica gesto/novo PDF. O resultado é meramente diagnóstico, nunca autorização.

A classificação original segue sendo chamada sem alteração, as duas leituras e o PID continuam obrigatórios e uma leitura inicial inválida mantém BLOCK. Nenhum PDF bruto, XML, dados reais, janelas, nomes de Activity, coordenadas, PID, mensagens privadas, dumpsys ou exceções vão aos logs. Não há alteração no app, APK, tempo de espera de navegação, número de gestos, fallback, instalação, Release ou app estável.

## Controle

Oito execuções independentes Android 9 API28, o mesmo APK experimental Debug-signed SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`. Todas as permissões do workflow continuam read-only. Se a intermitência não ocorrer, a nova execução é inconclusiva quanto à causa.

P0 #120/#126 OPEN, PR #125 Draft, `approvedForProduction=false` e `stableReleaseAllowed=false`. Nada de `main`, merge, OTA, produção, boleto pagável ou dados financeiros reais.
