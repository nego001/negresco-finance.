# P0 Guardião | três repetições independentes Android 9 (API28) no candidato v4

## Objetivo

A prova integrada [#43777952185](https://github.com/nego001/negresco-finance./actions/runs/43777952185) terminou em **SUCCESS** com quatro PDFs sintéticos A–D, três retornos Home e verificações scoped de três abas antes/depois dos retornos, em PID preservado, além de recibos do receptor independente e limpeza de cache. A [CI #43777952094](https://github.com/nego001/negresco-finance./actions/runs/43777952094) terminou **SUCCESS**, com **1.450/1.450 contratos**.

Esses resultados observados não provam que uma falha **intermitente** do `Print.printToFileAsync` foi eliminada no Release histórico. Não extrapolar o teste do candidato.

## Ensaio de repetibilidade, sem alterar o APK

Esta branch cria apenas um workflow e contratos estáticos. Uma matriz de três jobs `alpha`, `beta`, `gamma`, com `fail-fast: false`, usa três ambientes efêmeros Android API28 distintos para rodar **exatamente** `tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py`, sem nenhuma alteração em código da aplicação ou no runner.

Cada job deve verificar:
1. APK experimental exato (build [#43772274643](https://github.com/nego001/negresco-finance./actions/runs/43772274643), SHA-256 `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6`) e assinatura `CN=Android Debug`.
2. Um Home inicial com duas provas scoped, três retornos com provas scoped pré/pós, sempre mesmo PID e sem reinstalação do aplicativo.
3. Quatro PDFs sintéticos recebidos/verificados por receptor isolado, todas as páginas não vazias, texto sem conteúdo proibido, cache limpo.
4. Toda falha de chooser, navegador, processo, PDF ou do reconhecimento de abas mantém o job **FAIL**, nunca vira PASS por timeout, por outro candidato ou por relatório fabricado.

**Critério de êxito da matriz:** 3 jobs *SUCCESS*, cada um com 4 ciclos completos; no máximo 12 PDFs adicionais sintéticos **se todos concluírem**. Nenhum resultado é considerado PASS antes do relatório real do GitHub.

A versão histórica imutável SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` permanece ausente dos artefatos disponíveis. Este ensaio não testa, não reconstitui e não aprova esse binário. Mesmo os 3 jobs verdes não resolveriam isoladamente a causa-raiz de #120.

**Bloqueios obrigatórios:** #120 e #126 OPEN; PR #125 DRAFT/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem dados financeiros reais, Pix, merge, OTA, Release pública, assinatura estável ou distribuição.
