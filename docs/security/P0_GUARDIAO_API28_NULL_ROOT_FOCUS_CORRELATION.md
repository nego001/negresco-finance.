# Guardião API28 — janela após falha de captura null-root

## Resultado já confirmado (18/11/2026)

A [CI #44228447222](https://github.com/nego001/negresco-finance./actions/runs/44228447222) terminou **SUCCESS, 1578/1578 contratos** e todos os jobs obrigatórios aprovados. A [matriz de três emuladores #44228447232](https://github.com/nego001/negresco-finance./actions/runs/44228447232) terminou **0 PASS/3 BLOCK**. Nos três, o comando `adb shell uiautomator dump` realizado no caminho exclusivo de captura retornou **código de saída zero, stdout vazio e stderr categorizado null-root**. A mensagem do Android é compatível com ausência de uma raiz de acessibilidade naquela tentativa; não estabelece a causa dessa ausência. O gate recusou a captura e não aceitou reutilizar XML anterior.

A função do harness antigo retorna apenas stdout, de modo que o erro em stderr não era visível para o classificador de ACK. A instrumentação de streams isolou essa divergência **sem alterar o resultado do comando**.

## Nova medição read-only e estritamente condicionada

O módulo `guardiao_api28_null_root_focus_correlation_lab.py` observa a resposta do *mesmo* `subprocess.run` do `uiautomator dump`; só quando encontrar a combinação exata `returncode=0, stdout vazio, stderr contendo null root node`, realiza **uma única** consulta adicional `adb shell dumpsys window windows` com timeout 8s e `check=False`. A resposta é categorizada pelo parser de foco já existente: `window-focus-app`, `window-focus-chooser`, `window-focus-ime-named`, `window-focus-other`, `window-focus-null`, `window-focus-unconfirmed`. Não registra texto de janela, Activity, package, XML, stdout/stderr, PID, SHA, exceção, URI nem dados financeiros.

Se o comando de foco falhar, retorna apenas `window-focus-unconfirmed`. **Nenhuma nova tentativa de XML, gesto, reload, espera, continuação da navegação ou relaxamento do BLOCK**. O resultado original do subprocesso continua intacto e o gate de `CaptureUnconfirmed` o rejeita. O foco é medido depois da falha, **não atomicamente** com o dump; `window-focus-app` posterior não comprova que a Activity estava ativa no instante do null-root.

O wrapper usa três emuladores Android9 API28 isolados e o mesmo APK experimental fixado no SHA `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`, assinado com Debug, sem reconstruir nem tocar no app. Instrumentação de múltiplas camadas altera um pouco o tempo e não deve ser usada para declarar correção a partir de taxas de PASS.

P0 #126 (captura e retorno após chooser) e #120 (Print do histórico Release, sem APK original disponível) permanecem OPEN. PR #125 Draft, main imutável, `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem pagamentos, boletos válidos ou distribuição.
