# Guardião P0 | Auditoria independente de recibos Android 8/9 (laboratório)

## Escopo

Continuação empilhada sobre a PR #116, que exercitou o PDF produzido pelo APK de teste fixado por SHA-256, com entrada estritamente fictícia, inválida e não pagável (prefixo 8 e 47 zeros). Esta etapa não altera o APK financeiro, valida boleto real ou autoriza operações financeiras.

O risco coberto é a publicação de um recibo JSON adulterado ou inflado que declare sucesso indevido. O verificador independente tooling/android/verify_collection48_receipt.py recebe somente o JSON de metadados, ou um ZIP de artefato GitHub que contenha exclusivamente esse JSON.

## Invariantes do verificador

- Validação rígida de chaves permitidas, tipos e valores: proíbe campos extras, duplicados, omitidos, números não finitos e JSON malformado.
- Exige o SHA-256 exato do APK testado, API 26 ou 28 conforme o job, identificador fixo do cenário inválido, escopo de laboratório e versão do esquema.
- Confere flags de caminho Android, chooser, receptor independente, texto extraível, cache e captura apagados, sem aceitar números como booleanos.
- Confere contagem de páginas, páginas renderizadas/não vazias/com texto (de 1 a 8), tamanho limitado e formato do SHA-256 do PDF reportado.
- Exige approvedForProduction=false e stableReleaseAllowed=false.
- Abre arquivos em descritores com O_NOFOLLOW e verifica tipo e limite no próprio descritor: impede troca por symlink entre pré-checagem e leitura e impede leitura sem limite.
- Limita JSON a 4 KiB e ZIP a 1 MiB; ZIP deve conter exatamente um JSON com nome fixo, sem caminhos de travessia, entrada adicional, comentários ZIP, dados anteriores ao primeiro cabeçalho, link simbólico ou criptografia.
- Falha de forma fechada com erro de categoria fixa, sem imprimir caminhos, texto de PDF, documentos, linha digitável ou exceções.
- A CI no branch de laboratório executa o verificador antes de publicar o recibo JSON de retenção de dois dias.

## Cobertura negativa

O arquivo tests/guardiao-collection48-receipt-verifier.test.mjs cria metadados sintéticos em diretórios temporários e injeta alterações controladas: API errada, checksums, APK divergente, páginas não verificadas, flags falsas, esquema incorreto, campo sensível adicional, chave duplicada, ZIP com PDF adicional, comentários ocultos, prefixos antes do ZIP, travessia de diretórios, ZIP corrompido, symlink e nome inesperado. Nenhum dado real nem PDF bancário é usado.

## Comprovação e limites

A verificação confirma a consistência estrutural de um recibo. Sozinha não prova que o Android executou o aplicativo, que o PDF original corresponde ao SHA reportado ou que um emissor de cobrança é legítimo. Essas comprovações exigem revisar separadamente runner e receptor dos E2E, seus logs de categoria e a origem do APK.

A PR #116 apresentou PASS nativo nas APIs 26/28 no workflow #40708437566, com repetição adicional da API 28. O FAIL anterior do Android 9 continua sem causa-raiz identificada. Este verificador não resolve esse comportamento: somente reforça a rejeição de recibos adulterados.

## Gates

- [x] Contratos do verificador: 1.225/1.225 PASS nas duas CIs da revisão `f66dbe0` (runs #40727477405 e #40727487652, job `contracts`). Nova alteração de leitura por descritor requer nova revalidação.
- [x] CI nativa Android 8/API 26 integra o verificador antes do upload na revisão `f66dbe0` (run #40727477322 PASS).
- [x] CI nativa Android 9/API 28 integra o verificador antes do upload na revisão `f66dbe0` (run #40727477322 PASS).
- [x] Artefatos publicados na revisão `f66dbe0` auditados de forma independente em 28/10/2026 (detalhes abaixo).
- [ ] Revisão humana da lógica, QA em aparelhos físicos e autorização de release: fora deste escopo.

approvedForProduction=false; stableReleaseAllowed=false. PR Draft, sem merge na main, nova assinatura, release, OTA, pagamentos ou dados de clientes.

## Evidências imutáveis da revisão `f66dbe0` (28/10/2026)

- Android 8, API 26: artefato `12834565124`, ZIP 687 bytes, SHA-256 `82069c85777307e638d9c8a82c9db6d23293d61018a7fad3f2393716d889b457`; exatamente um JSON de 874 bytes; PDF sintético **declarado** com 1 página, 39.294 bytes e SHA-256 `29c80490b0b0c4ea609ce3e07ff806e515da0766afb491c7eeab4f42d8f2bb36`.
- Android 9, API 28: artefato `12834096663`, ZIP 687 bytes, SHA-256 `cb97f279ac8c89a1a57d5e0b0ab39ce5e0017bbfcc2867559a8a6081f3ea996a`; exatamente um JSON de 874 bytes; PDF sintético **declarado** com 1 página, 39.185 bytes e SHA-256 `2a6f46057f8d4dc6aa204ecb53406ee3939064e4660d28ba9e8b28f961c23637`.
- Auditoria offline independente: contagem/nome de entradas, contiguidade de ZIP, descriptor de dados, stream DEFLATE consumido integralmente, esquema/chaves/tipos, flags, escopo, APK pinado, API, tamanho e formato de digest. Ambos os metadados passaram. Nenhum PDF, captura de tela, UI ou conteúdo financeiro anexado.
- Logs da execução #40727477322 registram a verificação do APK, inicialização do app, seletor Android, receptor separado, SHA/tamanho do PDF, extração textual em todas as páginas e limpeza. Isso não comprova execução em aparelho físico nem origem criptograficamente atestada.
- A falha intermitente inicial no Android 9 continua sem causa-raiz isolada. Não promover o sistema a produção com base nesses testes de laboratório.
