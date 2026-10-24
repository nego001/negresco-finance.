# P0-1 | Preflight de colisão de releases públicas e drafts

Revisão de laboratório sobre a PR #41. Não executa publicação
e não modifica a `main`, regras do repositório ou segredos.

## Falha evitada

O antigo teste `if gh release view "$TAG"; then ...` tratava
qualquer erro da consulta como ausência de release. Um erro 403,
timeout ou problema de API poderia ser confundido com uma tag livre.

A API REST de `GET releases/tags/{tag}` também não resolve o
problema: sua documentação se refere à consulta de *releases
publicadas*. Para proteger drafts privados, a API **List releases**
inclui drafts acessíveis para uma identidade autenticada com
permissão de push.

## Implementação

- O mesmo token limitado a `contents:write` para o job consulta
  `gh api --paginate --slurp "repos/$GH_REPO/releases?per_page=100"`.
- São inspecionadas **todas as páginas**, sem impor limite de
  30 ou 100 releases. Cada página deve ser um array.
- Uma entrada com `tag_name` equivalente à tag esperada
  interrompe o fluxo independentemente de `draft`.
- Um erro de rede, permissão, limite de API, JSON inválido,
  página ausente, campo de tag ausente ou estrutura desconhecida
  também impede **qualquer criação de tag Git**.
- Somente ausência comprovada de colisão permite continuar
  para o preflight de referência Git e para a criação do draft.

## Cenários testados

Cli `gh` simulada com resultados nominais e colisões:
release pública na primeira página, draft na primeira página,
draft na segunda página, erro de consulta, JSON inválido,
lista incompleta ou estrutura malformada. A suíte existente
também conserva testes de autenticidade da tag, hash SHA256
remoto e política de releases imutáveis consultada antes/depois.

## Limitações

A listagem é uma checagem pontual, não uma transação atômica:
outro ator autorizado pode criar uma release entre a consulta
e a chamada `gh release create`. A API de criação deve
continuar recusando conflitos, enquanto as políticas de tags
e a configuração de releases imutáveis precisam de revisão
administrativa. Esta mudança não pede mais permissões.

As consultas podem demorar para repositórios com numerosas
releases ou falhar por rate limiting. Esse cenário bloqueia
a publicação intencionalmente; não há fallback permissivo.
