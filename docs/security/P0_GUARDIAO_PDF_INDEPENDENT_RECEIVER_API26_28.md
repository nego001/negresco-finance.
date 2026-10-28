# P0 | Recebimento real e renderização de PDF por outro aplicativo Android

**Laboratório experimental, exclusivo para emuladores descartáveis Android 8 (API 26) e Android 9 (API 28). Não é homologação financeira.**

## Ponto de partida
A PR #109 obteve **2/2 PASS** na abertura de `ChooserActivity`/`ResolverActivity`, em imagens `google_apis`, com o APK Debug da PR #106 SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`. Aquele smoke validava **somente a abertura do seletor**. Não comprovava recebimento, conteúdo, integridade nem capacidade de renderização em outro aplicativo.

## Novo ensaio E2E
- Compilar app Android Java **separado** em `tooling/android/pdf-receiver-lab` com `javac`, `d8`, `aapt2`, `zipalign` e `apksigner` do Android SDK, **sem Gradle/Maven** (a dependência Maven retornou HTTP 403 no runner), sem dependência de runtime do Negresco, sem permissão de Internet, armazenamento ou qualquer outra. O manifesto expõe **uma única Activity** para `ACTION_SEND application/pdf`; nenhuma tela ou atividade de produção é modificada.
- Instalar esse receptor Debug e o **mesmo** APK original da PR #106, cuja identidade SHA-256 é conferida antes de qualquer instalação. Executar offline com 47 zeros sintéticos de boleto deliberadamente inválido.
- Acionar análise e exportação no Guardião e observar `ChooserActivity`/`ResolverActivity`. Selecionar a opção `Negresco PDF Receiver LAB` do próprio seletor Android.
- No receptor: exigir `Intent.ACTION_SEND`, MIME `application/pdf`, `content://` e concessão temporária de leitura; limitar stream a 8 MiB; escrever exclusivamente no próprio cache privado; conferir cabeçalho `%PDF-`, marcador `%%EOF` nos últimos 1.024 bytes e SHA-256 incremental; abrir com `PdfRenderer`, exigir de 1 a 100 páginas e **renderizar página 1** em bitmap de 96x96; reciclar bitmap e apagar arquivo temporário.
- Persistir unicamente `files/receipt.json` **dentro do app receptor**, com booleanos, contagem de páginas, tamanho e hash SHA256 da amostra sintética. O teste externo só lê esse **recibo**, com `adb shell run-as`, e só escreve relatório mínimo sem PII se todas as condições forem aprovadas.
- Não capturar nem publicar conteúdo do PDF, hierarquia XML, screenshots, logcat, cache, URI, HTML, CNPJ ou dados bancários.

## Critérios de aprovação
- [ ] Código e contrato de segurança Node, inclusive zero permissões do receptor.
- [ ] Receptor Android compila diretamente com SDK, assinado temporariamente no runner, e é instalado em API 26.
- [ ] API 26: seletor nativo encaminha PDF ao receptor, arquivo íntegro e primeira página renderizada.
- [ ] API 28: mesma verificação.
- [ ] Relatórios contêm só metadados sintéticos, hash do arquivo e identificação do APK.
- [ ] Revisão humana de conteúdo do relatório financeiro real, do cancelamento, do bloqueio, da permissão URI e de aparelho físico ainda pendentes.

## Segurança e escopo
`FileProvider` do Negresco deve continuar `exported=false`; o compartilhamento depende apenas da concessão temporária da URI via o seletor. O receptor é **teste independente** e fica **fora** do APK do Negresco; não deve ser distribuído. Assinatura do APK financeiro continua Android Debug, OTA preview unsigned, main intacta. Mesmo 2/2 PASS comprova apenas PDF sintético recebido e página 1 renderizada no emulador, não a exatidão de todas as páginas/valores ou QA em aparelho físico. `approvedForProduction=false`, `stableReleaseAllowed=false`.
