# Guardião P0 | Autorização do arquivo PDF antes do compartilhamento

## Risco de segurança observado na revisão da fonte

A função `exportPdfWithLifecycleGuard` aceitava qualquer `file://...pdf` em nome do arquivo devolvido pela ponte nativa de impressão, apesar de o próprio `pdfCache.ts` já exigir uma forma mais restrita para apagar arquivos: `cacheDirectory/Print/<UUID>.pdf`. Um caminho aparentemente válido mas fora do cache próprio poderia, em hipótese de retorno nativo inesperado, ser repassado a `Sharing.shareAsync`. Não há evidência de que isso já tenha acontecido em um dispositivo real.

## Contenção introduzida nesta branch de laboratório

No caminho concreto de `apps/mobile/App.tsx`, passa-se o predicado `isOwnedPdfUri:uri=>isOwnedPrintPdfUri(uri,FileSystem.cacheDirectory)` ao exportador. O predicado é testado após o retorno da impressão e após a autorização de foreground, **antes** da sondagem de disponibilidade e do seletor. Só aceita a convenção Expo Print documentada: caminho privado `cache/Print/` seguido por UUID real e extensão PDF, sem query, fragmento, travessia ou caminho arbitrário.

A propriedade foi adicionada como porta **opcional** da biblioteca para compatibilidade com os testes portáveis existentes, mas está **ligada obrigatoriamente no App mobile**. Falha ou exceção do validador é tratada como `invalid-uri`, sem repassar endereço ou erro nativo. A limpeza continua limitada ao cache próprio e só pode ocorrer antes de iniciar o compartilhamento.

A suíte `tests/guardiao-pdf-owned-uri-share-gate.test.mjs` inclui matriz sintética de caminhos externos/forjados, raiz inválida, callback que lança erro, retorno truthy não booleano, token revogado, não compartilhamento e não deleção de arquivo externo. Nenhum dado bancário ou arquivo real é usado.

## Limites da evidência

**Esta branch altera a fonte do candidato; alterações em `apps/mobile/` disparam automaticamente um workflow de APK experimental assinado com certificado Android Debug. Isso NÃO equivale a teste E2E no Android, assinatura estável ou aprovação de produção.** Os APKs experimentais v4 já atestados em Android 8/9 **não contêm automaticamente esta mudança**. Uma futura compilação descartável nova, com hash e assinatura independentes e prova E2E equivalente, seria necessária antes de afirmar comportamento no dispositivo.

A mudança também **não explica nem corrige** o travamento intermitente do APK histórico SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`. A verificação do cache lida com o retorno *após* impressão; não ajuda se a impressão nunca retorna.

**Bloqueio permanente:** #120/#126 OPEN, PR #125 DRAFT/unmerged, `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem merge, OTA, publicação, assinatura estável, dados financeiros reais ou Pix/pagamentos.
