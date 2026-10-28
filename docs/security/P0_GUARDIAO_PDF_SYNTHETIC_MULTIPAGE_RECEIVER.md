# Guardião P0 | PDF sintético de três páginas no receptor Android (LAB)

## Objetivo e limites
Esta etapa empilhada sobre a PR #111 valida especificamente o loop de renderização de **mais de uma página** em Android 8 (API 26) e Android 9 (API 28). As PRs #110 e #111 cobrem o compartilhamento real do APK financeiro auditado via seletor de compartilhamento e o recebimento por aplicativo independente, mas aquele PDF continha somente **uma página**.

Este experimento **não** recompila ou instala o APK financeiro e **não** é uma repetição do fluxo real de compartilhamento entre apps. O provider privado e o receptor são componentes do **mesmo APK de laboratório**. A cobertura de terceiros/URI grant anterior deve ser avaliada separadamente.

## Método fail-closed
1. Gerar em memória com `PdfDocument` dois PDFs inteiramente sintéticos e sem qualquer identificador real. Cada um tem três páginas.
2. A variante `nonblank-3` contém tinta escura sobre fundo claro em todas as páginas, com número da página.
3. A variante `blank-middle-3` mantém a primeira e a terceira páginas desenhadas, mas deixa a segunda em branco.
4. Entregar o conteúdo por `content://com.negresco.pdfreceiver.lab.fixtures/...` de um `ContentProvider` **não exportado**, através de pipe. Não há PDF criado no armazenamento externo, no workspace ou publicado no CI.
5. Invocar o caminho de recebimento e renderização existente com `ACTION_SEND` e tipo `application/pdf`. O receptor usa `PdfRenderer` para avaliar cada página. É obrigatório receber recibo de sucesso com `pages=3`, `nonblankPages=3`, `allPagesRendered=true` e cache privado limpo.
6. A variante em branco deve falhar **especificamente** no índice zero-based 1, com recibo `status=blocked` e `reason=blank-page`. Se a falha ocorrer antes, não será aceita como aprovação do cenário negativo.
7. O teste apaga recibo antigo antes de cada envio e falha se não puder consultar o cache privado.

Somente `pdf-multipage-emulator-report.json` (metadados mínimos e hashes) poderá ser publicado por 2 dias. Nada de PDF, bitmap, screenshot, XML, logcat, dados bancários ou recibos com conteúdo.

## Critérios de aceitação
- [ ] Testes de contrato Node e outros jobs CI aprovados no commit atual.
- [ ] API 26: cenário positivo renderiza 3/3 páginas e negativo rejeita somente a segunda página; ambos deixam cache limpo.
- [ ] API 28: mesma comprovação.
- [ ] Artefatos metadata-only de ambas as APIs baixados e analisados independentemente.
- [ ] Auditoria do conteúdo/campos do relatório gerado pelo app financeiro real (ainda não coberta).
- [ ] QA em aparelhos físicos e demais versões Android.
- [ ] Assinatura, modelo OTA, revisão humana e requisitos de produção.

`approvedForProduction=false` e `stableReleaseAllowed=false`. PR mantida em Draft e branch empilhada. Nenhum merge em `main`, release ou OTA.

## Evidência E2E confirmada independentemente (28/10/2026)

**HEAD de código/testes auditado:** `be903841f79bd969bb9aedc2b8216a21a051bcf4`, com PR #112 em Draft. Três execuções verdes: CI push `40642132866`, CI PR `40642138346` e laboratório multipágina `40642132868`. A verificação não utilizou documentos bancários, dados pessoais, APK financeiro ou assinaturas de distribuição.

As duas matrizes Android `google_apis` tiveram jobs próprios concluídos com sucesso: API 26 e API 28. Os arquivos ZIP publicados pelo workflow foram baixados e abertos independentemente. Cada ZIP tinha **somente** `pdf-multipage-emulator-report.json`. O arquivo foi parseado como JSON e verificado com igualdade de chaves, limites de tamanho, tipo de cada campo, SHA-256 hexadecimal, ambas as provas de limpeza de cache, e os sinalizadores explícitos de proibição de produção.

| Prova | Android 8 / API 26 | Android 9 / API 28 |
| --- | --- | --- |
| Artifact ZIP / ID | `12796540014` | `12796068455` |
| `renderedPages` e `nonblankPages` | 3 / 3 | 3 / 3 |
| `pdfSizeBytes` (PDF estritamente sintético) | 15990 | 15870 |
| SHA-256 do PDF sintético (não do ZIP) | `a7a8318dc8a903dab229cf801700d6a2e60b79397cc945bc21a2b179450e6f50` | `27a03509ccab12d9f3f97abb31004998e9497b53ebbc98f97c6fc3463ec3c1b8` |
| Rejeição intencional | `blockedBlankPageIndex=1` | `blockedBlankPageIndex=1` |
| Cache limpo em sucesso e bloqueio | true / true | true / true |
| Permissão para produção | false | false |

**Interpretação estrita:** isso comprova o resultado informado pelos dois receptores sintéticos e que os relatórios CI correspondem ao contrato esperado. Não é inspeção visual externa dos bitmaps, prova de autenticidade dos arquivos PDF, homologação de relatório real multipágina, teste de conteúdo bancário ou revisão de aplicativo instalado. Os PDFs sintéticos não foram publicados nem recuperados desta CI. O segundo app independente com PDF real de uma página foi testado na PR #110/#111, separadamente.

**Gates concluídos nesse HEAD:** testes de contrato e CI, Android API 26 e 28 3/3 com rejeição específica, e inspeção dos dois artefatos JSON. **Gates ainda bloqueados:** validar semanticamente o conteúdo de relatório real a partir de dados totalmente fictícios, QA física, assinatura permanente, OTA, revisão humana e autorização de produção. **Sem merge, sem APK financeiro, sem release.**
