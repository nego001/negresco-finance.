# Negresco Finance P0 | Android9: diferenças entre rótulos do rodapé e atalhos no conteúdo

## Resultado das duas execuções anteriores

A [CI #43872152342](https://github.com/nego001/negresco-finance./actions/runs/43872152342) terminou **SUCCESS, 1.496/1.496 contratos**. Os dois jobs Android9 da [matriz #43872152467](https://github.com/nego001/negresco-finance./actions/runs/43872152467) também foram **SUCCESS**; cada um comprovou quatro PDFs A/B/C/D, três retornos Home no mesmo processo, e 14 resultados `scoped-three-tabs-verified` de geometria de abas.

Os logs observacionais anotaram o rótulo `Início` como `home-label-bounded`, `on-bottom-band`, ancestral `geometry-eligible` em ambos os jobs, sempre. O classificador geral de irmãos, entretanto, oscilou **sem qualquer falha do classificador estrito**, entre `siblings-missing-or-ambiguous` na tela Início e `siblings-both-regular` na tela do Guardião.

Essa aparente contradição é esperada quando a consulta geral de Pix/Negresco inclui outros rótulos de tela com o mesmo texto, como um atalho Pix, enquanto a verificação estrita filtra apenas os rótulos do rodapé. **A causa específica dessa ambiguidade ainda não foi confirmada nos snapshots**, pois os logs não divulgam a árvore de acessibilidade.

## Nova medição, sem alterar o critério de segurança

Quatro emuladores limpos Android9/API28 executam o **mesmo APK v5** `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`, `CN=Android Debug`, do build #43789332636. Cada um tenta quatro PDFs sintéticos e três retornos Home no mesmo PID, preservando a mesma exigência rigorosa de duas leituras `scoped-three-tabs-verified` por etapa.

Um diagnóstico *somente leitura* agora separa rótulos `Início`, `Pix` e `Negresco` localizados na faixa inferior de rótulos com esses nomes fora da faixa. O resultado é **apenas uma categoria fixa** como `footer-candidates-unique-pix-extra` ou `footer-candidates-not-unique`. Não registra quantidades, nomes de aplicativos, árvore, coordenadas, conteúdo dos PDFs, caminhos, capturas, PID, XML ou logs brutos. O classificador **não verifica a área clicável**; portanto, não pode fornecer aprovação e o resultado original da verificação rigorosa continua inalterado.

Não adiciona consultas ADB, tempo, gestos, rolagem, reinstalação, build do APK, exceção que vira PASS ou upload de artefato. Falhas observadas seguem falhas do experimento.

**Interpretação:** a nova medição pode explicar a categoria generalista `siblings-missing-or-ambiguous` sem confundir com falha real. Quatro testes que passarem não provam estabilidade universal e não identificam causa-raiz do PDF no Release antigo, SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`, indisponível.

Issues #120/#126 OPEN e PR #125 DRAFT/unmerged. `approvedForProduction=false`; `stableReleaseAllowed=false`; sem publicação, OTA, assinatura estável, Pix ou dados financeiros reais.
