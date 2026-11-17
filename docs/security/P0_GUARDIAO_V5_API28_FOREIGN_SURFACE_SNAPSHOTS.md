# P0 Android 9 — fonte de nós externos na leitura transitória

## Resultado anterior confirmado

[CI #44098669841](https://github.com/nego001/negresco-finance./actions/runs/44098669841): SUCCESS, 1.508/1.508 contratos. [Android9 #44098670941](https://github.com/nego001/negresco-finance./actions/runs/44098670941): três jobs PASS e um FAIL (trial 2). No trial 2, PDF A foi recebido, renderizado, semanticamente verificado e teve cache apagado. Na primeira leitura pré-retorno, a árvore era **não vazia**, mas `app=absent app-text=absent nonapp=present`, sem Início, Pix ou Negresco. Na leitura seguinte (~1,3 s depois), `app=present app-text=present nonapp=absent` e todas as três abas foram confirmadas. O gate recusou o par contraditório e parou antes de PDF B. Portanto, a primeira leitura capturou nós identificados por pacote distinto do app; não prova mudança física de tela, nem sua causa.

## Novo experimento: qual família de superfície foi lida?

Instrumentação adicional aproveita exatamente os mesmos nós em memória e publica **sete flags fixas** de presença/ausência para **pacotes exatos**: receptor PDF sintético, Android framework (`android`), SystemUI, launcher, IME, DocumentsUI e outros/desconhecidos. No caso de mais de uma categoria, reporta cada presença sem escolher ou assumir janela em foco. Pacotes imitadores são classificados como `other`; nomes literais de pacotes não são publicados nos logs.

**Limites rigorosos:** sem novo ADB, snapshot, espera, gesto, captura, arquivo, PDF, debug de texto, XML, logcat ou leitura de dados reais; APK experimental SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4` do build #43789332636, ainda Debug-signed. Quatro emuladores Android API28 independentes, mesma fixture falsa. Toda decisão de tocar/voltar depende do verificador original exigir duas leituras válidas e PID/geométria corretos. Uma leitura inválida continua BLOCK, mesmo que a seguinte esteja válida.

**Interpretação:** observar `framework=present` não demonstra que era necessariamente o chooser; observar `receiver=present` não prova que a atividade do receptor estava em primeiro plano. Esse é um diagnóstico de nós retornados, não de foco de janela.

A branch combina o HEAD integrado `98d3978` (regressão double-snapshot fail-closed) com a medição passiva `560c612` e a classificação adicional. Issues #120/#126 OPEN; PR #125 Draft; `approvedForProduction=false` e `stableReleaseAllowed=false`. Sem merge, OTA, app de produção, boleto pagável, transação ou dados financeiros reais.
