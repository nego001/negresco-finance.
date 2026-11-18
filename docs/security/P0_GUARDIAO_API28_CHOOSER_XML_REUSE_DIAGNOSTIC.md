# API28 P0 #126 — comparar a última árvore chooser com a primeira árvore pre-return (somente laboratório)

## Hipótese nova e falsificável

No runner de teste existente, `tooling/android/guardiao_pdf_ui_emulator_smoke.py` escreve toda hierarquia UIAutomator no mesmo caminho de trabalho `/sdcard/negresco_ui.xml` e, numa chamada ADB posterior, lê esse mesmo arquivo. A primeira árvore pre-return mostrou IDs estruturais de `ResolverActivity` mesmo em 3 falhas com foco `window-focus-app` antes e depois. Isso é COMPATÍVEL, mas NÃO prova que o arquivo `negresco_ui.xml` permaneceu com bytes de uma captura anterior. Uma resposta de sucesso do comando `uiautomator dump` não comprova frescor da árvore.

## Diagnóstico controlado, sem mudanças no APK nem novas operações ADB

Novo wrapper `guardiao_v5_api28_chooser_xml_reuse_lab.py` intercepta apenas respostas das operações ADB JÁ EXISTENTES:
1. Durante `receive_from_chooser` (já existente), guarda SOMENTE o SHA-256 em memória da última resposta XML obtida por `adb exec-out cat /sdcard/negresco_ui.xml`. Nunca retém texto/XML completo entre os estágios.
2. Quando `pre_snapshot_focus.sample` for chamado antes da PRIMEIRA leitura pre-return já existente, marca essa leitura e compara o hash da resposta `cat` seguinte com o hash de chooser em memória, imprimindo apenas `byte-identical-to-chooser`, `different-from-chooser`, `no-chooser-reference` ou `current-xml-unconfirmed`.
3. Classifica separadamente a RESPOSTA DE TEXTO do comando `uiautomator dump` já usado, entre `reported` e `unconfirmed`; nunca imprime conteúdo, caminho privado, digest ou identificadores Android. O status `reported` **não confirma que o arquivo foi atualizado**.
4. Depois da comparação, descarta a referência do chooser. Todos os wrappers restauram as funções originais até quando há falha. As decisões de navegação, as duas leituras, o PID, a emissão e os quatro PDFs permanecem literalmente inalterados.

Não faz novas leituras Android, screenshots, logcat, waits, taps ou writes além daqueles do runner preexistente. O cálculo do hash adiciona alguma computação e pode alterar levemente o timing, então diferenças de taxas não demonstram correção. A comparação é de bytes de XML capturados pelo laboratório, não de estados de janela simultâneos. Mesmo `byte-identical-to-chooser` pode ocorrer se o Android devolver uma árvore idêntica em dois instantes; isso isoladamente não prova um arquivo reaproveitado. Já a diferença afasta a hipótese de reutilização byte a byte daquela última amostra exata, sem excluir outras capturas anteriores.

## Evidência histórica e gates

[CI #44220538612](https://github.com/nego001/negresco-finance./actions/runs/44220538612) foi SUCCESS com 1546/1546 contratos; a [matriz #44220538604](https://github.com/nego001/negresco-finance./actions/runs/44220538604) teve 5 PASS/3 BLOCK (trials 6,7,8), com IDs de resolvedor no primeiro snapshot e foco do app antes/depois. Os PDFs anteriores nesses trials foram verificados por receptor independente, e o gate BLOQUEOU corretamente.

Este laboratório repete oito emuladores Android9 API28 com o APK experimental de SHA `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`, não o Release histórico original SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`. O P0 original #120 segue separado e sem binário recuperado. P0 #126 e #120 abertos; PR #125 Draft; `main` intacta, `approvedForProduction=false`, `stableReleaseAllowed=false`, sem pagamento, boleto real, publicação, OTA ou assinatura de Release.
