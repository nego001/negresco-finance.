# P0-1 | Release imutável como pré-requisito de publicação

**Revisão de laboratório empilhada na PR #39.** Nada é integrado
em `main`, nenhuma release é publicada e nenhuma configuração
administrativa do GitHub é alterada nesta revisão.

## Por que esta proteção é necessária

A PR #39 valida diretamente a tag e o SHA do APK, mas nenhuma
consulta isolada impede a alteração da tag **depois** dessa consulta.
Releases imutáveis do GitHub protegem tanto os arquivos de release
quanto a tag após a publicação.

A API do GitHub documenta:
- `GET /repos/{owner}/{repo}/immutable-releases`;
- resposta **200** com `enabled: true` para repositório protegido;
- resposta **404** quando não está habilitado;
- leitura administrativa (`Administration:read`) necessária.

## Comportamento da PR

Antes de criar qualquer tag Git ou draft, o job manual de publicação
consulta o endpoint e exige o JSON `{"enabled":true}`.

A ausência da configuração, JSON inválido, timeout, resposta 403
(token sem permissão) ou erro de rede bloqueiam o job. A checagem
não habilita a configuração, não altera regras existentes nem
desbloqueia a publicação sem a autorização explícita do titular.

**Atenção operacional:** o `GITHUB_TOKEN` do job com
`contents:write` pode **não ter Administration:read**.
Se isso acontecer, a publicação permanecerá intencionalmente
bloqueada até a definição de um processo seguro de verificação
de read-only admin, revisado pelo mantenedor. Não ampliar
automaticamente os privilégios do token, não colocar segredos
em log e não fazer exceção de segurança para obter um teste verde.

## Estado atual do repositório

Consulta GitHub neste ciclo retornou `[]` para os rulesets.
Isso **não equivale** a confirmar que immutable releases está
desativado: não foi possível consultar essa configuração com
as credenciais disponibilizadas nesta sessão.

É necessário configurar e auditar políticas de tag no próprio
repositório, usando revisão administrativa apropriada. Não
criar regras automaticamente sem revisar impactos no fluxo
de criação de tags e eventuais exceções do GitHub Actions.

## Testes e limitações

A suíte executa o script **real do workflow** com um cliente
`gh` simulado. Cobertura nova para configurações habilitadas,
desabilitadas, 404, 403, indisponibilidade e JSON malformado.
Ela demonstra comportamento de bloqueio e **não** comprova
que o GitHub real tenha o recurso habilitado.

A proteção de imutabilidade atua após a publicação. Entre
a última consulta da tag e sua publicação ainda existe uma
janela de concorrência; uma ruleset de tags avaliada de forma
independente pode ser necessária.

Critérios de integração: CI e build no mesmo SHA, publicação
SKIPPED, revisão do contrato de permissões e nenhuma
autorização financeira real.
