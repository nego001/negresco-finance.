# API28 P0 — oito emuladores independentes, mesma versão e mesmos gates

## Por que repetir?

A [CI #44144663346](https://github.com/nego001/negresco-finance./actions/runs/44144663346) foi SUCCESS com **1524/1524 contratos**. A [matriz de quatro emuladores #44144663591](https://github.com/nego001/negresco-finance./actions/runs/44144663591) terminou **4 PASS / 0 FAIL**, com quatro PDFs sintéticos verificados e três retornos Home no mesmo PID por tentativa. Nenhum snapshot problemático foi capturado e todos os `framework-resolver-id`, `framework-chooser-id`, `framework-dialog-id`, `framework-listlike`, `framework-choice-control` estavam ausentes durante as leituras. Essa observação é **inconclusiva**: o problema intermitente foi reproduzido anteriormente em [#44142336594](https://github.com/nego001/negresco-finance./actions/runs/44142336594), com dois emuladores PASS e dois BLOCK.

Nos BLOCK anteriores, o primeiro snapshot `scoped-pre-return` mostrava árvore do pacote exato `android`, com TextView, nós clicáveis, ID estrutural e pelo menos um retângulo >=60% da tela; o segundo mostrava a árvore do app. Não foi demonstrado que a janela fosse chooser nem que tivesse foco visual.

## Experimento controlado

Criar **oito execuções independentes** em emuladores descartáveis Android API28, sempre APK experimental SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4` do run #43789332636, assinado para testes. Não reconstruir nem alterar APK. O único ajuste do fluxo é ampliar o número de `matrix.trial` de quatro para oito, mantendo o mesmo código Python de classificação de resource IDs e os mesmos contratos de dupla leitura.

A finalidade é aumentar a chance de observar a intermitência do sistema no pós-PDF, **não** aumentar a taxa artificial de PASS. Qualquer snapshot inválido continua BLOCK, mesmo se o próximo for válido. Nenhum relógio de espera, gesto, lance de exceção, nova leitura ADB, persistência de UI ou bypass será introduzido.

## Interpretação e invariantes

- Oito PASS: candidato passa esse stress, mas P0 original permanece aberto; sem declaração de correção ou homologação de produção.
- Qualquer FAIL com `framework-*=` relevante: documentar apenas categorias fixas, sem textos, PDFs, IDs, screenshots ou conteúdo privado. Diagnóstico para o responsável pela navegação Android.
- Outros FAIL: inspecionar etapas e manter as salvaguardas; não reclassificar FAIL para sucesso.
- O caso de retorno do sistema não deve ser confundido com defeito da geração de PDF, pois os PDFs já foram validados antes desses bloqueios.

PR #125 continua Draft, issues #120 e #126 abertas, `main` e Release histórico intactos, `approvedForProduction=false`, `stableReleaseAllowed=false`. Nenhum dado financeiro real, OTA, merge, pagamento, instalação de produção ou alteração de segurança.
