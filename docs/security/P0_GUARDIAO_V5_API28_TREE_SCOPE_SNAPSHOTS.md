# P0 Android 9 — escopo da árvore de acessibilidade em snapshots contraditórios

## Fato observado em 17/11/2026

[Diagnóstico #44013223992](https://github.com/nego001/negresco-finance./actions/runs/44013223992) concluiu com 2/4 jobs PASS e 2/4 FAIL. Trials 1 e 3: após PDF sintético A verificado no receptor independente, a primeira leitura de `scoped-pre-return` não encontrou nenhum TextView habilitado de Início, Pix ou Negresco; a segunda leitura encontrou as três abas. O gate bloqueou corretamente antes de PDF B. Trials 2 e 4 passaram os quatro PDFs e os três retornos ao Início no mesmo PID. A [CI integrada #44013528558](https://github.com/nego001/negresco-finance./actions/runs/44013528558) concluiu SUCCESS em todos os jobs. Isso não valida a produção.

## Pergunta deste laboratório

Quando os três nomes estão ausentes, o snapshot é (a) completamente vazio, (b) composto só por nós sem o pacote do aplicativo, (c) composto por nós do aplicativo sem TextView, ou (d) contém TextViews do aplicativo, mas sem os rótulos de navegação?

O novo wrapper classifica **os mesmos nós em memória já capturados** pela implementação anterior:
- `tree=empty/nonempty/unconfirmed`;
- `app=present/absent/unconfirmed` para pacote exato do aplicativo;
- `app-text=present/absent/unconfirmed` para TextViews dentro do app;
- `app-other-text=present/absent/unconfirmed` para um texto/descrição não vazio que não seja exatamente Início/Pix/Negresco;
- `nonapp=present/absent/unconfirmed` para nós não identificados com o pacote do app;
- `app-nontext=present/absent/unconfirmed` para nós do app que não sejam TextView.

São apenas seis categorias fixas, sem contagens ou transcrição de textos. O wrapper não faz ADB extra, não imprime XML, dados, nomes de pacote, campos, coordenadas, PDF, capturas, erros internos ou exceções.

## Guardas e limites

Continua o mesmo APK experimental Android Debug SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`, obtido do build #43789332636, sem rebuild. Executam quatro emuladores Android 9 independentes; o verificador anterior mantém a exigência de **duas leituras completas válidas** e todas as barreiras de PID, geometria, receptor e semântica PDF.

Nenhuma categoria nova pode autorizar toque, e a recuperação na segunda leitura não transforma a primeira inválida em PASS. A observação de uma árvore vazia tampouco prova que a interface física desapareceu: o snapshot pode ser transitório ou incompleto.

Issues #120 e #126 seguem abertas; PR #125 Draft. `approvedForProduction=false` e `stableReleaseAllowed=false`. Sem merge, OTA, build estável, pagamentos ou dados financeiros reais.
