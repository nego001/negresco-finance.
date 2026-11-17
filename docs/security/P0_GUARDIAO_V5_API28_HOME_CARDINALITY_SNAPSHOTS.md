# Guardião Android9 P0: cardinalidade do rótulo Início

## Evidência observada

[Stress #44011694992](https://github.com/nego001/negresco-finance./actions/runs/44011694992) terminou **FAIL (2/4 jobs PASS)**, apesar da [CI #44011694546](https://github.com/nego001/negresco-finance./actions/runs/44011694546) SUCCESS, 1.500/1.500 contratos.

Nos jobs PASS `133799970516` e `133799970101`, foram confirmados quatro PDFs reais com dados fictícios, três retornos Home e mesmo PID. No job `133799970523`, após três PDFs, e no `133799970597`, após um PDF, a primeira leitura `scoped-pre-return` registrou `footer-candidates-not-unique`, `home-label-unconfirmed`, `home-not-bounded`; a segunda observação foi válida. Os testes bloquearam corretamente **antes de tentar o PDF seguinte**.

Os logs também confirmaram atalho `Pix` fora do rodapé na tela Início e somente uma aba Pix no rodapé. Isso explica a ambiguidade do diagnóstico geral, mas **não** o rótulo `Início` não confirmado.

## Próxima medição

Quatro novos emuladores Android9 usam o mesmo APK experimental SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4` (Debug signed, build #43789332636). A instrumentação passiva identifica **zero/um/vários** rótulos `Início` habilitados (`TextView`) em toda a árvore de acessibilidade, e candidatos inferiores de Início/Pix/Negresco; para rótulo Início único, relata apenas a faixa geométrica fixa.

Somente **reaproveita nós já coletados**; não reexecuta ADB, não captura coordenadas, nomes de usuários, PDFs, prints, credenciais, textos privados ou árvore de UI. O resultado original dos verificadores scoped permanece obrigatório. Não altera SDK, APK, timeout, gestos ou critério de aprovação; uma primeira leitura inválida continua FAIL.

Os testes de contrato usam nós sintéticos para demonstrar distinção entre Início ausente, duplicado, deslocado e válido, sem liberação indevida.

Issues #120/#126 OPEN; PR125 DRAFT/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. APK Release histórico SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` indisponível; sem merge, OTA, pagamentos ou dados reais.
