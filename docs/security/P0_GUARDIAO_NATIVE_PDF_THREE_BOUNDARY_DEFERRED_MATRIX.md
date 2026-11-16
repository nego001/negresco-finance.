# Guardião P0 #120 — matriz determinística dos três limites nativos (sem APK)

## Contexto confirmado

A auditoria histórica do APK imutável `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` encontrou no Android 9 **três execuções com PDF sintético comprovado e três sem PDF comprovado**; o mesmo binário teve resultados diferentes. Não é seguro chamar `Print.printToFileAsync` de causa exata apenas porque o chooser não apareceu. A prova integrada do candidato v4 **não** reproduziu a falha antiga: [Android9 seis cold starts #43785823881](https://github.com/nego001/negresco-finance./actions/runs/43785823881) foi 6/6 SUCCESS; [CI #43786960436](https://github.com/nego001/negresco-finance./actions/runs/43786960436) foi SUCCESS com 1.470/1.470.

## O que esta matriz acrescenta

O arquivo `tests/guardiao-pdf-native-boundary-deferred-matrix.test.mjs` testa **as funções de produção existentes**, sem modificar o aplicativo, sem build de APK, sem Android, sem arquivos financeiros e sem conexão de rede.

Com Promises controladas manualmente, induz **três bloqueios independentes**:
- `print`: a impressão nunca resolve; não pode ocorrer consulta de compartilhamento, chooser ou segunda impressão, e o gate de single-flight permanece ocupado.
- `availability`: a impressão retorna um URI sintético local, mas a consulta de disponibilidade do compartilhamento fica pendente; gate permanece ocupado e nenhum chooser pode começar.
- `share`: a impressão retorna, o compartilhamento é considerado disponível, mas o próprio chooser fica pendente; gate permanece ocupado e o arquivo não pode ser apagado enquanto o Android potencialmente o lê.

Em todos, revogar foreground/autorização **não libera uma chamada nativa em curso**, e a conclusão tardia precisa retornar `cancelled`, nunca `shared`. O gate só libera quando o await real termina. Falhas explícitas de cada fase devem reportar **exclusivamente** o nome fixo `print`, `availability` ou `share`. URI e erros são sintéticos e nunca entram nas categorias expostas.

O teste também confere que o callback `onPendingPhase` não pode iniciar nova operação quando revoga permissão de uso, e preserva a regra do cache: apagar somente arquivo que **não foi entregue** ao compartilhamento nativo; never delete a PDF that may be in use.

## Limitação honesta

**Esta suíte não reproduz um travamento real no Android.** As Promises são simuladas. Ela verifica que o aplicativo não cria um segundo problema de segurança quando a função nativa real demora ou falha; **não** demonstra causa-raiz, correção de WebView, driver, Expo Print, lifecycle Android, nem melhora mensurável do desempenho.

As próximas evidências de causa precisam vir da **cópia idêntica do APK antigo** e de um teste controlado de retorno das fases nativas em Android 8/9, com diagnóstico categórico sem logs privados. Até lá, classificar `PDF não comprovado`, nunca `print nativo comprovadamente travado`.

## Regras mantidas

Issue #120 e #126 **OPEN**, PR #125 **DRAFT/unmerged**. `approvedForProduction=false`; `stableReleaseAllowed=false`. Sem merge, OTA, nova compilação de Release público, assinatura de produção, dados financeiros reais, Pix ou pagamento. Nenhum arquivo privado gravado, compartilhado ou coletado pela matriz.
