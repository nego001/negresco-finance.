# P0 #126 | Experimento alternativo: captura UIAutomator com destino único por leitura

## Evidência de partida

A matriz de oito emuladores [#44225448021](https://github.com/nego001/negresco-finance./actions/runs/44225448021) na última consulta já tinha quatro falhas (trials 2,3,5,6) e duas aprovações; os outros ainda executavam. Em TODOS os quatro bloqueios observados até então:
- o PDF sintético anterior foi validado por receptor independente;
- o foco pré-snapshot e o foco pós-snapshot indicavam o app;
- o primeiro dump UIAutomator retornou bytes XML **idênticos ao último XML capturado durante chooser**;
- o classificador viu apenas nós do framework Android/resolver, e a segunda leitura mostrou o app;
- a resposta do comando `uiautomator dump` NÃO tinha confirmação reconhecida pelo classificador `dump-ack=unconfirmed`.

Esse conjunto favorece a hipótese de falha no refresh do caminho compartilhado `/sdcard/negresco_ui.xml` seguida de leitura da cópia anterior. **Não comprova** que a chamada não atualizou o arquivo; duas capturas de uma tela idêntica também produzem o mesmo hash, e o ACK é inferido de string fixa.

## Teste diferencial, exclusivamente nos emuladores descartáveis

Um wrapper de ADB do laboratório intercepta APENAS os dois comandos existentes `uiautomator dump /sdcard/negresco_ui.xml` e `exec-out cat /sdcard/negresco_ui.xml`:
1. Substitui o destino de cada dump por um caminho novo imprevisível sob `/data/local/tmp/ng_ui_*.xml`; esse arquivo não pode conter a captura do chooser anterior. Nenhuma leitura ADB extra é feita para selecionar o caminho.
2. Exige ACK de dump mencionando aquele caminho exato. Se o Android retorna erro (incluindo `could not get idle state` ou `null root node`), registra categoria fixa e **BLOQUEIA ANTES** de ler XML, evitando ler qualquer arquivo antigo.
3. Redireciona a leitura original ao novo caminho e remove-o imediatamente em `finally`. Essa limpeza adiciona um comando ADB `rm -f` por captura, portanto ALTERA o timing. Se ler, limpar ou validar falhar, não há PASS.
4. O mesmo código de validação de duas leituras de Home, mesmo PID e quatro PDFs continua intocado. Não há novos taps, rolagens, retries, relaxamento de gate, mudança em URI, APK ou código de produção.

A comparação entre as taxas de PASS de A/B não é prova causal, pois o novo destino, exigência de ACK e limpeza alteram tempo e fluxo. O objetivo é identificar se o arquivo reaproveitado está fazendo o teste observar uma árvore velha. É hipótese de **instrumentação de teste** e não conserto da sincronização real do aplicativo Android.

O workflow dispara quatro emuladores API28 independentes com APK test-only Debug-signed SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`. Não usa dados financeiros reais, não publica os arquivos XML ou nomes privados e não altera `main`, PR #125 Draft, #120/#126 OPEN, `approvedForProduction=false`, `stableReleaseAllowed=false`. O P0 original do Print permanece sem APK Release imutável recuperado.
