# Guardião P0 | Recebedor Android: todas as páginas não vazias, cache descartado

## Motivação e evidência anterior
[PR #110](https://github.com/nego001/negresco-finance./pull/110) e [execução 40630686360](https://github.com/nego001/negresco-finance./actions/runs/40630686360): **Android 8/API 26 e Android 9/API 28** receberam PDF do Negresco com `ACTION_SEND`, validaram `content://` e sua concessão, bytes de cabeçalho e EOF e renderizaram a **primeira página**. Arquivos sintéticos eram de uma página (39.196 e 39.106 bytes). CI 9/9 e 1.171 contratos. Essa evidência **não** validava outras páginas ou imagens inteiramente em branco.

## Garantias desta PR
- A aplicação financeira e o APK SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` permanecem **idênticos** ao artefato auditado da PR #106 (run `40617164086`). Só muda o receptor independente, descartável e sem permissões.
- O receptor Java renderiza **todas** as páginas (máximo 100) com `PdfRenderer.Page`, verifica dimensões positivas e não aceita páginas sem pixels de tinta e fundo suficientemente distintos. O bitmap **nunca sai da memória** e é reciclado imediatamente.
- Validar que `verifiedPages == pageCount`. Relatório mínimo `allPagesRendered=true` e `nonblankPages=pages` só pode ser escrito após validação completa e fechamento do renderer.
- Um sucesso só passa se o processo verificador confirmar o recibo real e o **cache privado do receptor não contiver `received-*`**, evitando declarar sucesso enquanto o arquivo temporário persiste.
- Recebedor de teste mantém `application/pdf`, `ACTION_SEND`, `content://`, concessão URI temporária, zero permissões, `allowBackup=false`, `usesCleartextTraffic=false`, certificado de 1 dia e `android:debuggable=true` **somente para possibilitar `run-as` no teste**.
- A árvore de UI, screenshot, logcat, documento em bytes, bitmap, URL e conteúdo do boleto **não são publicados**. Recibo tem somente hashes, booleanos, páginas, tamanho e versão do SDK.

## Gates
- [ ] Contratos Node de proteção e regressão de impressão parcial.
- [ ] API26: receptor real obtém PDF por chooser, renderiza todas as páginas não vazias e esvazia cache.
- [ ] API28: mesmo fluxo.
- [ ] Relatórios de ambos passam inspeção de proveniência e ausência de dados financeiros.
- [ ] Avaliação de layout, exatidão dos campos e QA em aparelhos físicos ainda pendentes.
- [ ] Assinatura release, OTA assinado ou embedded-only e revisão humana permanecem pendentes.

**Escopo dos testes:** o PDF atual tem uma página, portanto o loop de páginas adicionais é verificado no código e precisa de um fixture multipágina separado para homologação de mais de uma página. Esta PR NÃO prova correção de conteúdo financeiro ou garantia de que toda página futura será correta. `stableReleaseAllowed=false`, `approvedForProduction=false`; nenhum merge em `main`, release ou OTA.
