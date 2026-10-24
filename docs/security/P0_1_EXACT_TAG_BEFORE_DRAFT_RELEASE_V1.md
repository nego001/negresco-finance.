# P0-1 | Tag Git vinculada ao commit aprovado

PR de laboratório baseada na #38. Nenhuma publicação real é acionada
pela alteração; `main` e chaves permanentes seguem intocadas.

## Falha ainda possível na #38

O campo `targetCommitish` da GitHub Release não é a autoridade final
sobre a referência `refs/tags/<tag>`. Além disso, ao criar uma
**release draft**, o GitHub pode adiar a criação da tag até sua
publicação. Assim, inspecionar somente `targetCommitish` deixava uma
lacuna para mudança de tag entre o preflight e a publicação.

## Nova política

- Recusar qualquer release já existente e qualquer tag existente.
- Distinguir o HTTP 404 de autenticação/timeout/erro de API, bloqueando
  caso a ausência da tag não possa ser comprovada.
- Criar **explicitamente uma tag Git lightweight** via endpoint
  `POST /repos/{owner}/{repo}/git/refs`, fixada ao `GITHUB_SHA`
  completo do mesmo workflow. A API bloqueia tentativa de criar uma
  referência que já exista.
- Validar o JSON de criação e consultar novamente a referência remota,
  exigindo `ref == refs/tags/<tag>`, `object.type == commit` e
  `object.sha == GITHUB_SHA`. Não permitir tags anotadas ou
  redirecionamento para outro objeto.
- Exigir `gh release create --verify-tag --draft`, mantendo o pacote
  privado enquanto os arquivos são carregados.
- Após conferir nomes, tamanhos, estado e hashes SHA-256 de todos os
  assets, **consultar de novo** a referência Git. Apenas em seguida
  poderá ser executado `gh release edit --draft=false`.
- Em qualquer divergência, interromper com `exit != 0` e nunca
  executar o comando de publicação.

## Testes

`tests/android-draft-release-atomicity.test.mjs` simula ausência de
tag, falha na criação, resposta de criação forjada, tag apontando para
SHA incorreto, tag anotada, desaparecimento da referência, alteração
depois do upload e as falhas anteriores de asset e prerelease.
`tests/android-explicit-release-tag.test.mjs` garante que a ordem
das operações e o bloqueio `--verify-tag` permaneçam no workflow.

## Limites operacionais

A criação da tag Git ocorre **antes** do draft; portanto um erro após
esse ponto pode deixar uma tag pública órfã, mesmo sem APK publicado.
Não fazer limpeza automática com permissões amplas; exigir
investigação, autorização do titular e registro de auditoria.

Ainda existe uma janela de concorrência entre a última leitura da
referência e o comando final de publicação. Em produção, proteger tags
via regras do repositório, limitar operadores com `contents:write`,
avaliar releases imutáveis e exigir revisão independente. A CLI
simulada não substitui um teste autorizado e isolado com GitHub Releases.
