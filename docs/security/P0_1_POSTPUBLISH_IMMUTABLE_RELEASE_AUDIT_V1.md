# P0-1 | Auditoria da release imutável após a publicação

Revisão de laboratório sobre a PR #43. Não executa publicação
nem faz alterações na `main`, regras administrativas ou secrets.

## Lacuna

As PRs #38–#43 impedem a publicação quando as verificações
*pré-publicação* não passam. Isso não prova, por si só, que o GitHub
marcou como `immutable` a release já visível ou que o objeto de
release e os arquivos continuaram idênticos depois da transição.

## Nova auditoria

O job manual de publicação:

1. Confirma a release privada, os quatro assets e seus digests SHA256;
   registra temporariamente o `databaseId` de release retornado pela
   CLI, exigindo um número inteiro seguro e positivo.
2. Revalida a tag Git e a configuração de releases imutáveis.
3. **Somente quando autorizado pelo operador**, usa a transição
   `gh release edit --draft=false` para tornar a prerelease pública.
4. Reconsulta a tag Git e chama o endpoint REST da release
   `GET /repos/{owner}/{repo}/releases/tags/{tag}`.
5. Exige que o GitHub retorne o mesmo ID numérico do draft,
   `tag_name` original, `draft:false`, `prerelease:true`,
   `immutable:true`, e exatamente os quatro assets aprovados,
   incluindo nomes únicos, tamanho, estado `uploaded` e digests
   SHA256 calculados localmente.

Qualquer inconsistência ou falha de rede causa erro explícito
no job e exige investigação e resposta manual.

## Limite de segurança importante

**Auditoria posterior não impede uma exposição anterior.** Uma
divergência constatada nessa fase significa que o objeto já pode
estar público, portanto a execução fica vermelha e deve haver
revisão imediata do operador; não há exclusão automática de uma
release imutável nem de tags compartilhadas.

Os testes utilizam `gh` simulado e não publicam APK real. Eles
cobrem ID ou imutabilidade alterados, tag diferente, estado draft,
prerelease ausente, ativos ausentes/duplicados, digest divergente,
erro de API e tag trocada depois da publicação.

Critérios antes de integração: testes Node e Android completos no
SHA final, permissões de leitura administrativa adequadas, release
imutável configurada no repositório por administrador autorizado,
revisão independente e aprovação explícita para qualquer publicação.
