# Guardião | Gate de rótulos LAB no APK Release

## Evidência que motivou o gate

A [PR #122](https://github.com/nego001/negresco-finance./pull/122) adicionou marcadores `[LAB: ... pendente]` exclusivamente no código `__DEV__` para ajudar a investigar [issue #120](https://github.com/nego001/negresco-finance./issues/120). Seu APK candidato, baixado do workflow [#40886636943](https://github.com/nego001/negresco-finance./actions/runs/40886636943), tem 61.369.789 bytes, SHA-256 `e92014511bf8eb4795ce4e82f40bd55c578cb7ce06046ff9581440032e8fd61c`, assinatura de teste Android Debug em APK montado pelo Gradle `assembleRelease` e um único `assets/index.android.bundle` Hermes. A varredura independente de bytes não encontrou o marcador literal `[LAB:`, inclusive em UTF-16LE.

## Novo controle

O workflow de build executa o script `verify_guardiao_release_no_lab_markers.py` sobre o **APK realmente montado**, antes de publicar qualquer artefato. O script exige o caminho de APK normal, ZIP legível e um único `assets/index.android.bundle` não criptografado, com leitura descompactada limitada a 64 MiB. Se achar `[LAB:` UTF-8 ou UTF-16LE, falha com erro fixo, sem expor conteúdo do APK. Recibos e testes de contrato usam somente entradas sintéticas.

A verificação **não garante** que todo texto dinâmico ou ofuscado esteja ausente; é uma defesa extra contra regressão de rótulos literais. O gate após upload existente continua conferindo o SHA do APK baixado. Não substituir testes em aparelhos reais ou auditoria funcional por uma varredura de strings.

## Limites

A PR #123 é um experimento sobre a PR #122; não altera pagamentos, assinaturas, permissões ou runtime do aplicativo. O APK candidate **assembleRelease não executa os rótulos `__DEV__`**, portanto não encerra a issue #120. Ainda é necessário um APK Debug em teste separado, com escopo restrito e revisão antes de qualquer deploy.

`approvedForProduction=false`, `stableReleaseAllowed=false`: nenhuma produção, merge na `main`, assinatura de release, OTA ou transações financeiras.
