# P0 — Contrato imutável para duas leituras scoped contraditórias

Na [execução Android9 #43794532582](https://github.com/nego001/negresco-finance./actions/runs/43794532582), o job `133060213136` registrou no retorno antes do PDF B `scoped-geometry=home-not-bounded` seguido por `scoped-three-tabs-verified`. A falha correta foi **BLOCK**; não houve falha confirmada da impressão nativa. Em outro job, quatro PDFs funcionaram. Em duas execuções mais recentes [#43872152467](https://github.com/nego001/negresco-finance./actions/runs/43872152467), a geometria passou nas duas leituras em cada estágio.

Este contrato usa a função de laboratório já existente `attest_triplet` **em isolamento**, sem emulador. Fornece apenas duas categorias de geometria por vez, sem Android e sem arquivo PDF. Exige:
- Primeira inválida e segunda válida: **BLOCK** e exatamente duas leituras;
- Primeira válida e segunda inválida: **BLOCK** e exatamente duas leituras;
- Duas válidas: apenas a atestação passiva de uma fase pode ser confirmada. Isso não atesta PDF, navegação ou produção.

Ele proíbe a tentação de aceitar a última leitura boa quando a anterior foi ruim. Nenhuma nova leitura, gesto, fallback, atualização de aplicativo ou mudança de política de aprovação foi implementada. A CI executa casos Python sintéticos a partir de Node e preserva o código funcional original.

A origem de uma eventual leitura `home-not-bounded` continua desconhecida: pode ser a geometria renderizada durante uma transição ou a observação de acessibilidade. A matriz Android9 de quatro instalações [#44011694992](https://github.com/nego001/negresco-finance./actions/runs/44011694992) foi iniciada separadamente, sem que este commit afete seus jobs.

**Produção permanece bloqueada:** #120/#126 OPEN, PR #125 DRAFT/unmerged, `approvedForProduction=false` e `stableReleaseAllowed=false`. APK histórico original SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` ainda indisponível, sem pagamentos, dados privados ou publicação.
