# CI | Recuperação limitada de HTTP 429 no Gradle

Revisão de laboratório sobre a PR #42, sem publicar APK nem
mesclar alterações na branch `main`.

## Evidência

O job `authority-postgres-lab` da PR #41 recebeu
`HTTP 429 Too Many Requests` do Maven Central ao consultar o BOM
`org.jetbrains.kotlin:kotlin-gradle-plugins-bom:2.0.21`. Isso aconteceu
durante a resolução de plugins, **antes dos testes reais**. Uma tentativa
manual de repetir o job foi solicitada apenas após a conclusão da
execução, sem alterar a validação do banco de dados.

## Mudança

O laboratório PostgreSQL continua realizando as mesmas verificações
com `psql -v ON_ERROR_STOP=1`, o teste multiconexão e os dois cenários
`pgBoundProofCheck` e `pgRekeyCasCheck` em sequência.

Antes dos **testes Kotlin**, ele chama
`tooling/ci/gradle-metadata-429-preflight.sh`, que executa apenas
`gradle -p tooling/native-lock-spike help --no-daemon`, aquecendo o
cache de metadados do Gradle.

Se o preflight falha:
- A nova tentativa só ocorre ao detectar indícios específicos de HTTP
  429 ou `Too Many Requests` na saída Gradle.
- São até **três execuções** no total, com pausas limitadas de 3 e
  6 segundos.
- Qualquer outro erro de Kotlin, plugin, configuração ou build encerra
  sem tentar novamente.
- Após três 429 consecutivos a CI falha, **nunca sinaliza sucesso**.
- Nenhum teste SQL nem as duas tarefas Kotlin de prova são repetidos
  ou marcados `continue-on-error`.

A CI de contratos utiliza uma CLI Gradle falsa apenas para simular
429, falha comum, retorno normal, limite de 3 chamadas e diretório
ausente. O build real será confirmado pela execução GitHub Actions.

## Limites

Um novo HTTP 429 durante dependências específicas de uma tarefa,
que não sejam resolvidas por `help`, ainda pode falhar o job. Isso
é preferível a repetir silenciosamente transações/asserções de banco
ou ignorar qualquer teste. O preflight não pode substituir a
execução e aprovação dos jobs reais.
