# P0-1 | Credencial de leitura isolada para política de releases

Revisão de laboratório empilhada na PR #40. Não altera `main`,
segredos do repositório, configurações administrativas ou releases.

## Separação de privilégios

O workflow manual de publicação já utiliza um `GITHUB_TOKEN` com
`contents: write` para criar a tag Git, montar o rascunho e carregar
assets. A API `GET /repos/{owner}/{repo}/immutable-releases` requer
**Administration:read**, permissão diferente.

Esta revisão **não** concede `Administration:write` ao token padrão.
Adiciona referência ao segredo reservado
`NEGRESCO_RELEASE_POLICY_READ_TOKEN`, destinado exclusivamente à
consulta da configuração de imutabilidade:

- usar token fino ou GitHub App, escopo do **repositório Negresco Finance**,
  com `Administration:read` e nenhuma permissão de escrita;
- configurar via controles administrativos do GitHub, com expiração,
  rotação e auditoria; nunca copiar o token para código, documentação,
  artefatos, notas de build ou logs;
- não usar um token administrativo completo ou reutilizar o token de
  publicação para satisfazer o controle;
- não assumir que a credencial já existe. Se ausente, a publicação
  **fica bloqueada** antes de qualquer mutação remota.

O endpoint é chamado temporariamente com
`GH_TOKEN="$RELEASE_POLICY_READ_TOKEN" gh api ...`. Os demais comandos
usam o `GITHUB_TOKEN` do job. A saída da API vai para arquivo efêmero
local, e mensagens de erro não incluem credenciais.

## Janela de publicação

A checagem de imutabilidade é executada duas vezes: imediatamente
antes de criar a tag e após verificar todos os hashes e a origem da
tag, imediatamente antes de tornar o draft público. Se a política
estiver desabilitada, a API indisponível ou a credencial sem permissão,
a release permanece privada e a execução falha.

Reverificar **reduz** a janela de alteração concorrente, mas não
fornece uma transação atômica com as configurações do GitHub.

## Cenários de teste

O simulador de GitHub CLI verifica que:
1. A consulta administrativa usa somente o token de leitura.
2. Sem segredo ou com o mesmo token de publicação, nenhum comando
   remoto de release é enviado.
3. HTTP 404/403/5xx, resposta inválida, `enabled:false` falham.
4. Política que muda de `enabled:true` para `false` após upload
   mantém o draft privado; erro de API na segunda consulta também.
5. Fluxo nominal exige duas verificações e não publica antes delas.

## Pré-requisitos ainda não satisfeitos

A revisão **não instala** um token, não ativa releases imutáveis,
não cria rulesets e não testa uma publicação real. Um mantenedor
autorizado deverá configurar e verificar a proteção e a credencial
antes de usar qualquer fluxo de publicação manual. A CI em branches
continua com `publish-test-prerelease` desativado.
