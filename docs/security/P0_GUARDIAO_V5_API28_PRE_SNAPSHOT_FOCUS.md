# Android9 P0 — foco imediatamente ANTES do primeiro snapshot pré-retorno

## Histórico que autoriza somente o experimento

A [CI #44163095653](https://github.com/nego001/negresco-finance./actions/runs/44163095653) passou (1542/1542 contratos). A [matriz Android9 #44156506495](https://github.com/nego001/negresco-finance./actions/runs/44156506495) terminou 6 PASS / 2 FAIL fechados. Nos failures 1 e 6, primeiro snapshot de UIAutomator foi composto só por nós do pacote framework android com `resolver_list` (resolvedor/diálogo/lista), mas a consulta do foco logo DEPOIS do snapshot já indicava `window-focus-app`. O segundo snapshot mostrou o app. Gate recusou primeiro snapshot inválido.

## Medição controlada, restrita a laboratório

Instrumentar `attest_triplet` sem modificá-lo. **Somente no estágio pre-return**, antes da PRIMEIRA das duas leituras UIAutomator que já existiam, realizar UMA consulta read-only `adb shell dumpsys window windows`, com timeout 8s e sem retry. O dump permanece privado e o parser allowlisted já existente `safe_window_focus_category` só produz:
- window-focus-app, window-focus-chooser, window-focus-ime-named;
- window-focus-other, window-focus-null, window-focus-unconfirmed.

Nos estágios initial e post-return, ZERO consultas adicionais. A segunda leitura pre-return não recebe consulta de foco anterior. O diagnóstico existente de foco pós-snapshot pode, condicionado ao próprio marcador de resolvedor, permanecer ativo e registrar `focus-after-snapshot`.

Essa adição **muda o timing do fluxo** e pode suprimir ou deslocar a própria corrida que investiga; um 8/8 PASS **não demonstrará correção do bug**, assim como categorias de foco antes/árvore/depois não constituem observação atômica da janela. Não comparar taxas como se houvesse randomização ou simultaneidade. Qualquer primeiro snapshot inválido segue BLOCK, mesmo se foco antes/depois indica app ou o segundo snapshot é válido.

O protocolo mantém exatamente o APK v5 experimental Debug-signed SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4` do run #43789332636, quatro PDFs sintéticos, três retornos com mesmo PID, receptor independente, e oito instâncias de emulador Android 9 API28. Nenhum APK reconstruído, nenhum dado real, texto XML, janela, PDF, URI, coordenada, logcat, screenshot, gesto ou temporização da aplicação nos logs.

P0 #120 (travamento no Print original) e #126 (navegação/accessibility) OPEN; PR #125 Draft; `approvedForProduction=false`, `stableReleaseAllowed=false`; `main` e Release histórico intocados.
