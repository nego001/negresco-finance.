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
