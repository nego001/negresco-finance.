# P0-1 | Identidade de commit e hashes remotos antes de publicar

Revisão **DRAFT de laboratório**, empilhada na PR #37; não altera
`main`, não instala APK e não executa publicação manual.

## Ameaças

- `gh release create --target SHA` **não altera a origem** caso a tag
  Git já exista. Reaproveitar uma tag de outro commit poderia associar
  arquivos válidos a código não autorizado.
- Conferir apenas nomes e tamanhos remotos não detecta substituição por
  conteúdo de tamanho idêntico depois do upload.
- Checksums empacotados no próprio artefato não substituem a confirmação
  de hash publicada pelo serviço de distribuição.

## Defesa adicionada

Antes de criar a release, o job privilegiado consulta a referência remota
`refs/tags/<TAG>` com a API. Somente HTTP 404 explícito permite criar
uma nova tag. Um tag existente, timeout, autenticação rejeitada ou outra
falha de API impedem a operação. O teste ainda rejeita releases existentes
independentemente do estado draft.

A conferência final lê `tagName`, `targetCommitish`, `isDraft`,
`isPrerelease` e os metadados de quatro assets pela CLI `gh`.
Ela exige exatamente o SHA de 40 caracteres de `GITHUB_SHA`, a tag
calculada, modo draft e prerelease, lista estrita de arquivos, tamanhos
idênticos, estado `uploaded` e um digest SHA-256 remoto de cada asset
igual ao hash SHA-256 calculado sobre os bytes locais.

Um digest ausente, malformado ou divergente bloqueia a publicação. O
GitHub disponibiliza SHA-256 de release assets desde junho de 2025;
esses digests são calculados pelo serviço no upload. A promoção do
rascunho só ocorre após todos os controles.

## Testes e limitações

- Simulação de tag preexistente e erro HTTP 503.
- Tag/commit errados, prerelease inválida e draft já público.
- Arquivo remoto com SHA256 alterado ou ausente e estado não `uploaded`.
- Mantém os cenários de upload falho, duplicata, tamanho incorreto e
  release existente. Os testes usam uma CLI `gh` simulada,
  **sem conectar a uma conta real**.

A integração end-to-end com a API de GitHub Releases e o próprio
certificado estável de produção **não é exercitada**: publicar continuaria
exigindo autorização explícita. A checagem de `targetCommitish` é
pré-publicação e não fornece uma transação atômica contra mudanças
concorrentes no Git. Continuidade exige revisão independente e CI real
no SHA final, mantendo `publish-test-prerelease` SKIPPED na branch.
