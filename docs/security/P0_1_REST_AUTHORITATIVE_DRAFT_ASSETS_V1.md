# P0-1 | API REST como fonte da verdade para assets

**Revisão de laboratório sobre a PR #45.** Não publica APK,
não altera `main` e não cria segredos.

## Problema de compatibilidade

A verificação anterior dependia de os objetos `assets` de
`gh release view --json` exporem os campos `state` e `digest`.
O contrato documentado da CLI lista o campo de nível superior
`assets`, mas não garante que cada asset tenha todas as
propriedades de resposta da API REST. Essa dependência poderia
rejeitar uma publicação legítima mesmo quando o GitHub confirmasse
os SHA-256 corretos. Um erro de compatibilidade não deve forçar
a equipe a desativar a checagem de hashes.

## Implementação

A CLI continua responsável apenas por uma *identidade curta e
obrigatória* da release privada: `databaseId` positivo,
`tagName` exata, `isDraft:true` e `isPrerelease:true`.

A verificação obrigatória dos quatro uploads usa exclusivamente
`GET /repos/{owner}/{repo}/releases/{id}`, autenticado com
a credencial de publicação. Ela exige o mesmo ID e tag, o draft
privado e quatro assets REST com nomes únicos, estados
`uploaded`, tamanhos iguais e SHA-256 **recalculados sobre os
arquivos locais**.

Uma API indisponível, digest ausente, conteúdo alterado ou
assets extras bloqueiam a transição pública. A auditoria de
imutabilidade pós-publicação permanece independente.

## Testes

A simulação da CLI inclui agora um caso em que todo o campo
`assets` está ausente, mas a API REST retorna quatro assets
válidos. Esse caso **deve prosseguir** até a auditoria.
Os cenários maliciosos anteriores de asset ausente, duplicado,
digest diferente, estado errado e tamanho alterado continuam
obrigatoriamente bloqueados, agora na consulta REST.

## Limites

Não houve publicação real. O endpoint REST por ID de uma release
em draft requer o acesso autenticado adequado; se for negado,
o job falha em segurança. A etapa não fornece atomicidade nem
substitui proteção de tags, releases imutáveis ou a revisão
independente exigida antes de publicação real.
