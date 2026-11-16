# P0 Guardião — diagnóstico restrito do Home no Android 9

A CI [#43793157201](https://github.com/nego001/negresco-finance./actions/runs/43793157201) terminou SUCCESS (1.491/1.491 contratos). O ensaio [#43793157261](https://github.com/nego001/negresco-finance./actions/runs/43793157261) teve Android8/API26 4/4 PDFs SUCCESS, mesmo PID e três retornos Home; no Android9/API28, 3/4 PDFs A/B/C PASS, mas o ciclo D bloqueou **antes do quarto PDF**.

O erro impresso foi `app home not observed after bounded launch wait` com app vivo/foreground. A função de espera imprime a mesma categoria quando uma atestação scoped anterior lança RuntimeError, portanto não é prova suficiente de que a tela Início, a impressão ou a navegação nativa falhou. O verificador deve permanecer rigoroso.

Esta nova experiência executa **duas repetições independentes Android9** com o mesmo APK de teste SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4` do build #43789332636, assinatura CN=Android Debug, sem mudar o APK ou o runner de quatro PDFs.

Um invólucro acrescenta somente códigos fixos, não sensíveis, para cada observação `scoped-geometry`, início de `initial/pre-return/post-return` e início/falha da única navegação Home já autorizada. Nunca publica XML, coordenadas, nomes de atividades, PID, arquivos, valores sintéticos, logs brutos ou PDF. Não adiciona toques, tempos, reinícios, esperas, re-instalação do app, fallback ou aprovação artificial; todo erro segue FAIL. Restaura os interceptores mesmo em exceção.

Critério: não declarar 4 PDFs / 3 retornos se um estágio falhar. Usar as categorias para localizar a primeira fronteira **não comprovada**. Isto não identifica a causa-raiz do antigo Release original SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`, indisponível.

#120 e #126 OPEN, PR125 Draft/unmerged. `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem publicação, merge, OTA, assinatura estável, pagamento ou dados reais.
