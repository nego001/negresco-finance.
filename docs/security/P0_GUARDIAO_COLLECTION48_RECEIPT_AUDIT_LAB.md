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
- Rejeita membros ZIP marcados como FIFO, dispositivo ou outro tipo Unix especial, aceitando apenas arquivo comum (ou sem atributo de tipo) mesmo que o nome termine em `.json`.
- Para ZIP com data descriptor (bit 3), exige CRC e tamanhos locais de cabeçalho zerados; recusa campos locais contraditórios que a biblioteca ZIP poderia ignorar. Regressão negativa injeta separadamente CRC, tamanho comprimido e descomprimido não nulos.
- Exige que versão necessária para extração, data e hora DOS do cabeçalho ZIP local coincidam byte a byte com o diretório central. Rejeita três adulterações que o leitor ZIP comum pode aceitar, sem imprimir conteúdo sensível.
- Recusa número de disco inicial não nulo, atributos internos opacos e atributos DOS inesperados no diretório central: três campos que leitores ZIP comuns podem ignorar e que poderiam carregar metadados encobertos. Aceita apenas os atributos DOS zero ou bit de arquivo (0x20), compatíveis com os artefatos legítimos observados.
- Rejeita também um caminho de recibo apontando para FIFO real sem bloquear a execução, conferindo o tipo pelo descritor aberto.
- Limita JSON a 4 KiB e ZIP a 1 MiB; ZIP deve conter exatamente um JSON com nome fixo, sem caminhos de travessia, entrada adicional, comentários ZIP, dados anteriores ao primeiro cabeçalho, link simbólico ou criptografia.
- Falha de forma fechada com erro de categoria fixa, sem imprimir caminhos, texto de PDF, documentos, linha digitável ou exceções.
- A CI no branch de laboratório executa o verificador antes de publicar o recibo JSON de retenção de dois dias.

## Cobertura negativa

O arquivo tests/guardiao-collection48-receipt-verifier.test.mjs cria metadados sintéticos em diretórios temporários e injeta alterações controladas: API errada, checksums, APK divergente, páginas não verificadas, flags falsas, esquema incorreto, campo sensível adicional, chave duplicada, ZIP com PDF adicional, comentários ocultos, prefixos antes do ZIP, travessia de diretórios, ZIP corrompido, symlink e nome inesperado. Nenhum dado real nem PDF bancário é usado.

## Comprovação e limites

A verificação confirma a consistência estrutural de um recibo. Sozinha não prova que o Android executou o aplicativo, que o PDF original corresponde ao SHA reportado ou que um emissor de cobrança é legítimo. Essas comprovações exigem revisar separadamente runner e receptor dos E2E, seus logs de categoria e a origem do APK.

A PR #116 apresentou PASS nativo nas APIs 26/28 no workflow #40708437566, com repetição adicional da API 28. O FAIL anterior do Android 9 continua sem causa-raiz identificada. Este verificador não resolve esse comportamento: somente reforça a rejeição de recibos adulterados.

## Gates

- [x] Contratos do verificador: **1.230/1.230 PASS**, zero falhas na revisão `4f9533d`, CI push `40736168671` e CI PR `40736180163`.
- [x] CI nativa Android 8/API 26 e Android 9/API 28: `40736168666` **PASS** nas duas APIs, verificador executado antes do upload.
- [x] Artefatos da revisão `4f9533d` inspecionados separadamente, somente JSON sintético sem PDF (detalhes abaixo).
- [ ] Novo gate de revalidação **após o upload**, com download de ambos os recibos do mesmo workflow, precisa de resultado verde no novo HEAD.
- [ ] Revisão humana da lógica, QA em aparelhos físicos e autorização de release: fora deste escopo.

approvedForProduction=false; stableReleaseAllowed=false. PR Draft, sem merge na main, nova assinatura, release, OTA, pagamentos ou dados de clientes.

## Evidências imutáveis da revisão `f66dbe0` (28/10/2026)

- Android 8, API 26: artefato `12834565124`, ZIP 687 bytes, SHA-256 `82069c85777307e638d9c8a82c9db6d23293d61018a7fad3f2393716d889b457`; exatamente um JSON de 874 bytes; PDF sintético **declarado** com 1 página, 39.294 bytes e SHA-256 `29c80490b0b0c4ea609ce3e07ff806e515da0766afb491c7eeab4f42d8f2bb36`.
- Android 9, API 28: artefato `12834096663`, ZIP 687 bytes, SHA-256 `cb97f279ac8c89a1a57d5e0b0ab39ce5e0017bbfcc2867559a8a6081f3ea996a`; exatamente um JSON de 874 bytes; PDF sintético **declarado** com 1 página, 39.185 bytes e SHA-256 `2a6f46057f8d4dc6aa204ecb53406ee3939064e4660d28ba9e8b28f961c23637`.
- Auditoria offline independente: contagem/nome de entradas, contiguidade de ZIP, descriptor de dados, stream DEFLATE consumido integralmente, esquema/chaves/tipos, flags, escopo, APK pinado, API, tamanho e formato de digest. Ambos os metadados passaram. Nenhum PDF, captura de tela, UI ou conteúdo financeiro anexado.
- Logs da execução #40727477322 registram a verificação do APK, inicialização do app, seletor Android, receptor separado, SHA/tamanho do PDF, extração textual em todas as páginas e limpeza. Isso não comprova execução em aparelho físico nem origem criptograficamente atestada.
- A falha intermitente inicial no Android 9 continua sem causa-raiz isolada. Não promover o sistema a produção com base nesses testes de laboratório.

## Nova etapa: verificação do par após publicação (28/10/2026)

O workflow recebe cada recibo antes do upload no respectivo job API 26/28. Um terceiro job isolado, condicionado ao sucesso de ambos, agora baixa apenas os dois artefatos publicados **desta execução** e recusa um artefato ausente, trocado ou com arquivos extras; então reexecuta o verificador offline com o número fixo de cada API. O verificador continua limitado a metadados sintéticos, sem tocar PDFs ou valores reais. Nunca considera uma API aprovada pela evidência da outra.

- Android 8 / API 26: artefato `12835969543`, ZIP **688 bytes**, SHA-256 `5042dbd9e39538902acfa45c51f5449de8c45b13ff802c346cc5e9d8f8386f09`; um JSON de **874 bytes**; PDF sintético **declarado** 1 página, **39.220 bytes**, digest `5adf77bbd97d316017de1bac13875635baffc5f2da3a199a078590c8ab31d1e4`.
- Android 9 / API 28: artefato `12836584625`, ZIP **690 bytes**, SHA-256 `be459658848c06eb6208a601a03bf07475d1c2e4a0fbd496cea7329a3fa8b53e`; um JSON de **874 bytes**; PDF sintético **declarado** 1 página, **39.219 bytes**, digest `f2d7feb006e0f67c9116ab0b9a8440df894467175ae913b992bc1b64b5f15636`.
- Ambos declaram fixture inválida, mesma hash exata do APK pinado, escopo restrito e flags de produção falsas. Esses dados não são prova criptográfica da execução do Android, e a antiga intermitência da API 28 segue sem causa-raiz conhecida.

## Complemento: teste executável do controle pós-upload (28/10/2026)

O terceiro job agora executa `tooling/android/verify_collection48_receipt_pair.py` em vez de depender apenas de uma contagem por shell. Na etapa de reforço seguinte, o diretório raiz, cada subdiretório e o JSON são abertos com descritores fixos e `O_NOFOLLOW`/`O_DIRECTORY`, impedindo desvio por troca de symlink entre a listagem e a leitura. A checagem de `fstat` exige arquivo regular e leitura limitada a 4 KiB; os descritores são fechados mesmo em erro. O verificador rejeita pastas ausentes/adicionais, links simbólicos, entradas extras e recibos API 26/28 trocados. Cada JSON é reaberto pelo verificador individual existente, com limite de leitura e sem seguir symlinks. Os testes Node criam pastas de laboratório e comprovam PASS de um par válido e bloqueios negativos dessas adulterações. A saída contém apenas códigos fixos, sem conteúdo do PDF ou dados financeiros.

**Este incremento exige revalidação no novo HEAD.** A execução de laboratório não autoriza produção, não substitui um dispositivo físico e não prova a autenticidade de um recibo.

## Regressão contra substituição de caminho (28/10/2026)

O gate pós-upload prende a raiz e as pastas Android aos descritores de diretório e usa `dir_fd` em cada abertura, evitando a janela de verificação por caminho seguida de reabertura. Os testes negativos exercitam symlink na raiz, symlink no JSON e FIFO como recibo sem bloqueio. Somente metadados sintéticos são lidos. A nova alteração exige CI verde no próprio commit antes de ser tratada como aprovada.
