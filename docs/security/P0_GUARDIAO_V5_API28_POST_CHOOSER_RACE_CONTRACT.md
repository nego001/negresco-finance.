# Negresco Finance — isolamento entre compartilhamento e retorno à Home

Evidência: CI [#44156506262](https://github.com/nego001/negresco-finance./actions/runs/44156506262) SUCCESS, 1538/1538 contratos. Matriz Android 9 [#44156506495](https://github.com/nego001/negresco-finance./actions/runs/44156506495) 6 PASS / 2 FAIL fechados, trials 1 e 6. Nos dois bloqueios houve PDF anterior sintético verificado. O primeiro snapshot pré-retorno continha nós de resolvedor do pacote exato android; a leitura de foco posterior já indicou app e o segundo snapshot mostrou abas normais. Duas leituras válidas são obrigatórias; a primeira inválida continuou BLOCK.

Este commit adiciona **apenas testes**, sem mudar o APK ou aplicativo. O teste usa o código real de exportPdfWithLifecycleGuard, classificação de resource IDs, observação de foco e attest_triplet, com dados sintéticos e leituras/PID simulados. Garante que conclusão da Promise nativa de Sharing.shareAsync NÃO autoriza um toque na Home; que foco posterior app/chooser/unconfirmed não substitui a primeira leitura do resolvedor; e que o critério de duas leituras/PID continua inalterado.

A comparação de foco ocorre depois da árvore, não atomicamente. Esse experimento não distingue uma transição rápida de uma árvore atrasada e **não é correção do bug nativo**. O P0 #120 de Print/WebView do Release original é independente do P0 #126 de navegação e deve seguir aberto.

Sem novo emulador, ADB adicional, timeout, gesto, QR, dados reais, captura, relatório PDF ou logcat. PR #125 Draft; main e APK Release histórico imutáveis; approvedForProduction=false; stableReleaseAllowed=false.
