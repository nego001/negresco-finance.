# P0-1 | Conferência REST independente do draft antes da publicação

Revisão de laboratório empilhada sobre a PR #44. Nenhuma release
é criada ou publicada e a branch `main` não é alterada.

## Risco coberto

O fluxo anterior verificava a release privada com
`gh release view --json ...`. Embora essa CLI forneça campos
úteis, a decisão de disponibilizar um APK não deve depender
exclusivamente de uma única representação da release.

A API REST de Releases fornece o ID numérico, `tag_name`,
`draft`, `prerelease` e, em cada asset, `name`, `size`,
`state` e `digest` SHA-256 calculado pelo GitHub.

## Nova etapa

Depois que o draft passa pela verificação da CLI e seu
`databaseId` numérico é armazenado em arquivo efêmero, o
job executa, **antes** da transição pública:

`gh api "repos/$GH_REPO/releases/$(cat "$RELEASE_DRAFT_ID_FILE")"`

Os campos REST devem confirmar:

- Exatamente o mesmo ID do draft aprovado pela CLI;
- Mesma tag, `draft:true` e `prerelease:true`;
- Exatamente os quatro arquivos autorizados, sem duplicatas;
- Estado `uploaded`, tamanho igual ao arquivo local e
  digest remoto SHA-256 correspondente aos bytes locais.

A API indisponível, uma resposta inválida ou qualquer divergência
encerra a execução sem chamar `gh release edit --draft=false`.
Em caso de falha, o draft permanece privado. A auditoria posterior
da PR #44 continua independente e inalterada.

## Testes

Cenários simulados: sucesso, erro de REST, JSON inválido,
ID/tag trocados, release inesperadamente pública ou não
prerelease, asset faltando/extra/duplicado, alteração de
estado/tamanho e hash remoto ausente ou diferente.

## Limites

A chamada REST por ID de um draft exige autenticação com
permissão suficiente. O workflow usa o token restrito de
publicação, não o token administrativo de configuração.
Se a API negar acesso a um draft, o job falhará em segurança.

Essa checagem não fornece transação atômica entre inspeção
e publicação. Uma release publicada ainda deve passar
pela auditoria pós-publicação de identidade e imutabilidade.
