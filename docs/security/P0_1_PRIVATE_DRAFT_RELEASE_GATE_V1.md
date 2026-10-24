# P0-1 | Publicação protegida por rascunho privado

A PR de segurança #37 é uma revisão **draft empilhada na #36**; a
publicação real está proibida até autorização explícita e integração futura.

## Risco de distribuição corrigido

Antes, `publish-test-prerelease` podia criar uma versão pública primeiro,
depois enviar os APK/ZIP/checksums. Se `gh release upload` falhasse após
a criação da versão, a página pública ficaria com arquivos incompletos.
Além disso, a tentativa de repetição substituía assets de uma release
existente com `--clobber`.

## Mudança de ordem da operação

1. Somente manual em `main`, `stable_signing=true`,
   `publish_release=true` após build aprovado.
2. O job privilegiado revalida o certificado do APK e o ZIP
   antes de sequer criar a release, conforme a PR #36.
3. Se uma release com a tag derivada do commit já existir,
   o comando falha explicitamente, sem editar nem sobrescrever.
4. Cria uma nova GitHub Release com `--draft` e `--prerelease`.
5. Envia APK, ZIP e os dois relatórios. Um upload interrompido
   falha mantendo a versão como rascunho, sem publicação pública.
6. Compara a lista exata de **quatro** assets no draft remoto e
   seus tamanhos declarados com os arquivos locais. Qualquer
   falta, excesso, nome duplicado ou divergência bloqueia a publicação.
7. Só depois dessa verificação realiza `gh release edit --draft=false`.

Os logs de falha não exibem chaves nem bytes de um APK. O job de build
permanece read-only, e push de branch nunca executa a rota de publicação.
O fluxo de upload **não é exatamente transacional**: falhas deixam drafts
remotos exigindo revisão/limpeza manual. Portanto a expressão
"publicação protegida por draft" é intencional, não uma promessa
de atomicidade de todos os recursos externos.

## Testes

`tests/android-draft-release-atomicity.test.mjs` extrai o script de
publicação diretamente do workflow e executa um cliente `gh` simulado.
Cobre sucesso nominal, upload falho, release já existente,
asset remoto faltante, asset extra, nome duplicado, tamanho adulterado,
draft indevidamente público e falha no último comando.

A simulação **não equivale a testar permissões do GitHub, conexão com
GitHub Releases ou assinatura real**. Sem autorização do titular,
nenhuma publicação manual será executada.
