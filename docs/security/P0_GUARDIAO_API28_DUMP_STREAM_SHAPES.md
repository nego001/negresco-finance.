# P0 Android 9 — diagnóstico limitado das duas saídas do UIAutomator

## Evidência de partida

A [matriz de XML individual #44226721487](https://github.com/nego001/negresco-finance./actions/runs/44226721487) terminou 0 PASS/4 BLOCK. Todos os quatro emuladores receberam `unique-xml-dump-ack=unconfirmed` em algum momento ANTES de um PDF ser comprovado. A [CI anterior #44226789992](https://github.com/nego001/negresco-finance./actions/runs/44226789992) foi SUCCESS, 1570/1570 contratos. O reforço contra erros de integridade do laboratório [`4fb36d4`](https://github.com/nego001/negresco-finance./commit/4fb36d42bd46aef8933d6b4894eb0a3142be1e96) passou em 1574/1574 contratos, com CI integral ainda pendente na última consulta.

A função original `guardiao_pdf_ui_emulator_smoke.run()` chama `subprocess.run(capture_output=True,text=True)`, mas devolve SÓ `p.stdout.strip()`. `p.stderr` e detalhes de erro do protocolo não entram no classificador de ACK. Uma saída stdout não reconhecida não basta para diagnosticar se o Android emitiu erro em stderr, respondeu em outro formato, deixou o stdout vazio ou se a leitura da interface estava apenas atrasada.

## Nova sonda, sem alterar aceitação

O script `guardiao_api28_dump_stream_shapes_lab.py` observa SOMENTE o retorno da chamada `subprocess.run` que já existe e corresponde a `adb shell uiautomator dump /data/local/tmp/ng_ui_*.xml`. Não executa uma chamada extra e retorna o MESMO objeto `CompletedProcess`. Não modifica timeout, `check`, ACK, XML, retries, navegação, PDFs, app ou APK. Usa categorias discretas fixas:
- Exit: `zero`, `nonzero`, `unconfirmed`, `timeout`, `exception`;
- Stdout e stderr separadamente: `empty`, `exact-ack`, `ack-with-extra-text`, `ack-other-or-no-destination`, `idle-unavailable`, `null-root`, `permission-denied`, `other-error`, `mentions-destination-without-ack`, `other-text`, `nontext`.

Nenhum stdout, stderr, endereço, XML, hash, identificador, argumento privado, nome de Activity ou exceção aparece no log. As mensagens de erro originais são preservadas internamente; em caso de exceção o wrapper não a suprime. A proteção `CaptureUnconfirmed` mantém BLOCK imediato em resposta não reconhecida.

Três emuladores independentes Android9/API28 usam o MESMO APK somente de laboratório assinado como Debug e com hash fixo `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`. A captura XML individual e a operação de limpeza permanecem; o timing pode variar e os resultados não provam causa do aplicativo. A verificação final do P0 #126 exige que a navegação pós-chooser seja observada sem viés de instrumento e o P0 #120 exige a cópia exata do Release histórico. Ambos OPEN. `main` intacta, PR #125 Draft, `approvedForProduction=false`, `stableReleaseAllowed=false`.
