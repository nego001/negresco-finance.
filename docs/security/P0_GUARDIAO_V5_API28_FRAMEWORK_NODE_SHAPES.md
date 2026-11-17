# Android 9 P0 — geometria dos nós do framework no snapshot inconsistente

## Evidência (17/11/2026)

A [CI #44101965352](https://github.com/nego001/negresco-finance./actions/runs/44101965352) terminou SUCCESS e 1516/1516 contratos passaram. A [matriz Android9 #44101965491](https://github.com/nego001/negresco-finance./actions/runs/44101965491) terminou 3 PASS / 1 FAIL (trial 4). No trial 4 foram verificados PDFs A e B com dados sintéticos. Antes do retorno seguinte ao Início, a primeira leitura tinha `tree=nonempty app=absent nonapp=present`, `foreign-framework=present` (pacote exato `android`) e os outros seis grupos externos ausentes. A segunda leitura voltou a encontrar todos os elementos do app. A geometria de navegação inválida seguida de válida foi bloqueada antes de PDF C. A identificação do pacote `android` **não prova** que a janela era o chooser nem que o app deixou de renderizar; descreve somente os nós coletados.

## Nova medição, sem nova coleta

O wrapper acrescenta categorias fixas dos mesmos nós em memória: `framework-nodes`, `framework-text` (classe TextView), `framework-buttons` (Button/ImageButton), `framework-clickable`, `framework-focused`, `framework-resource` (prefixos de recurso android permitidos) e `framework-area` (retângulo com pelo menos 60% da área da tela, apenas retângulos menores válidos, ou limites indisponíveis). As categorias servem para diferenciar árvore do framework com elementos de janela grande de poucos nós residuais. **Uma área grande não prova janela em foco, nem um chooser**.

O novo código não acessa conteúdo dos TextViews, resource IDs completos, dados financeiros, logs privados, capturas, PDFs ou XML. Não publica contagem ou coordenada. Não executa adb, novo dump, gesto, BACK, swipe, espera, atualização de APK ou reinício adicional. Os snapshots existentes e o verificador original fazem todas as decisões, duas leituras válidas seguem obrigatórias, e o primeiro snapshot inválido continua BLOCK.

Em quatro instâncias Android 9, o APK de teste permanece exatamente o SHA `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4` gerado no run #43789332636 e assinado para laboratório. O build original Release histórico permanece separado. P0 #120/#126 OPEN, PR #125 Draft, `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem merge, OTA ou pagamentos reais.
