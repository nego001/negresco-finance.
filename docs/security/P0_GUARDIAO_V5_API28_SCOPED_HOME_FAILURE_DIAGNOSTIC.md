# P0 Guardião — diagnóstico restrito do Home no Android 9

A CI [#43793157201](https://github.com/nego001/negresco-finance./actions/runs/43793157201) terminou SUCCESS (1.491/1.491 contratos). O ensaio [#43793157261](https://github.com/nego001/negresco-finance./actions/runs/43793157261) teve Android8/API26 4/4 PDFs SUCCESS, mesmo PID e três retornos Home; no Android9/API28, 3/4 PDFs A/B/C PASS, mas o ciclo D bloqueou **antes do quarto PDF**.

O erro impresso foi `app home not observed after bounded launch wait` com app vivo/foreground. A função de espera imprime a mesma categoria quando uma atestação scoped anterior lança RuntimeError, portanto não é prova suficiente de que a tela Início, a impressão ou a navegação nativa falhou. O verificador deve permanecer rigoroso.

Esta nova experiência executa **duas repetições independentes Android9** com o mesmo APK de teste SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4` do build #43789332636, assinatura CN=Android Debug, sem mudar o APK ou o runner de quatro PDFs.

Um invólucro acrescenta somente códigos fixos, não sensíveis, para cada observação `scoped-geometry`, início de `initial/pre-return/post-return` e início/falha da única navegação Home já autorizada. Nunca publica XML, coordenadas, nomes de atividades, PID, arquivos, valores sintéticos, logs brutos ou PDF. Não adiciona toques, tempos, reinícios, esperas, re-instalação do app, fallback ou aprovação artificial; todo erro segue FAIL. Restaura os interceptores mesmo em exceção.

Critério: não declarar 4 PDFs / 3 retornos se um estágio falhar. Usar as categorias para localizar a primeira fronteira **não comprovada**. Isto não identifica a causa-raiz do antigo Release original SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`, indisponível.

#120 e #126 OPEN, PR125 Draft/unmerged. `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem publicação, merge, OTA, assinatura estável, pagamento ou dados reais.


## Diagnóstico da primeira repetição (#43794532582)

A [CI #43794532531](https://github.com/nego001/negresco-finance./actions/runs/43794532531) concluiu **SUCCESS, 1.494/1.494 contratos**. [E2E #43794532582](https://github.com/nego001/negresco-finance./actions/runs/43794532582) encerrou **FAIL**, com resultados divergentes entre dois emuladores Android9:

- Trial 1, job `133060213136`: **FAIL** após PDF A comprovado, antes de navegar para PDF B. No estágio `scoped-pre-return`, uma leitura deu `scoped-geometry=home-not-bounded` e a seguinte `scoped-three-tabs-verified`. O par não é estável, então a atestação rejeitou corretamente. O marcador genérico `app home not observed` é secundário; não prova que o aplicativo perdeu o foco nem que a impressão falhou.
- Trial 2, job `133060213048`: **SUCCESS**, PDFs A/B/C/D reais com conteúdo e cache verificados, três retornos Home no mesmo PID e geometria de três abas estável.

Isso confirma **intermitência na observação/atestação da interface** nessa configuração de laboratório. Ainda não distingue defeito real de layout, transição visual rápida ou inconsistência do snapshot Android de acessibilidade.

### Instrumentação adicional nesta revisão

O mesmo runner, os mesmos toques, mesmas esperas, mesmas restrições e mesmo APK são preservados. Para cada snapshot *já existente*, a camada de diagnóstico agora registra apenas quatro categorias fixas: `home-snapshot` (visão geral), `label` (forma do rótulo Início), `ancestor` (área clicável ancestral) e `siblings` (geometria das abas Pix/Negresco). Não há nova consulta Android, captura adicional, coordenada, texto privado ou gesto.

O resultado original da atestação é retornado sem alteração. Se a primeira leitura divergir da segunda, **a falha continua bloqueada**, mesmo que a segunda esteja correta. Esses dados poderão apontar a razão da primeira leitura incompleta sem fabricar aprovação.

