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
- Limita JSON a 4 KiB e ZIP a 1 MiB; ZIP deve conter exatamente um JSON com nome fixo, sem caminhos de travessia, entrada adicional, link simbólico ou criptografia.
- Falha de forma fechada com erro de categoria fixa, sem imprimir caminhos, texto de PDF, documentos, linha digitável ou exceções.
- A CI no branch de laboratório executa o verificador antes de publicar o recibo JSON de retenção de dois dias.

## Cobertura negativa

O arquivo tests/guardiao-collection48-receipt-verifier.test.mjs cria metadados sintéticos em diretórios temporários e injeta alterações controladas: API errada, checksums, APK divergente, páginas não verificadas, flags falsas, esquema incorreto, campo sensível adicional, chave duplicada, ZIP com PDF adicional, travessia de diretórios, ZIP corrompido, symlink e nome inesperado. Nenhum dado real nem PDF bancário é usado.

## Comprovação e limites

A verificação confirma a consistência estrutural de um recibo. Sozinha não prova que o Android executou o aplicativo, que o PDF original corresponde ao SHA reportado ou que um emissor de cobrança é legítimo. Essas comprovações exigem revisar separadamente runner e receptor dos E2E, seus logs de categoria e a origem do APK.

A PR #116 apresentou PASS nativo nas APIs 26/28 no workflow #40708437566, com repetição adicional da API 28. O FAIL anterior do Android 9 continua sem causa-raiz identificada. Este verificador não resolve esse comportamento: somente reforça a rejeição de recibos adulterados.

## Gates

- [ ] Contratos do verificador (aceitação dos cenários fixos e rejeição de adulterações) aprovados na branch.
- [ ] CI nativa Android 8/API 26 integra o verificador antes do upload.
- [ ] CI nativa Android 9/API 28 integra o verificador antes do upload.
- [ ] Artefatos publicados auditados de forma independente.
- [ ] Revisão humana da lógica, QA em aparelhos físicos e autorização de release: fora deste escopo.

approvedForProduction=false; stableReleaseAllowed=false. PR Draft, sem merge na main, nova assinatura, release, OTA, pagamentos ou dados de clientes.
