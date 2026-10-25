# P0-1 | Verificação independente dos XMLs de backup pelo publicador

Revisão empilhada sobre a PR #55. Ela não altera `main`,
não publica uma release e não utiliza credenciais de produção.

## Falha de confiança entre CI e publicador

O build Android já bloqueia APKs cujos XMLs compilados de
`dataExtractionRules` e `fullBackupContent` não sejam as políticas
de exclusão planejadas. O publicador com permissão para criar releases
precisa confirmar essa política no **artefato efetivamente baixado**,
independentemente das alegações da CI.

## Solução

O job `publish-test-prerelease` recebe um novo passo
`Independently audit downloaded compiled backup XML`, executado
**depois** da inspeção do APK e da auditoria independente de rede,
mas **antes** do primeiro passo que possa criar tags, drafts ou assets.

O código Python da auditoria fica incorporado ao workflow privilegiado.
Não há checkout do repositório, download de scripts executáveis
de artefatos nem importação de código vindo do APK.

Os requisitos da auditoria são:

- Referências compiladas únicas e diferentes para
  `dataExtractionRules` e `fullBackupContent` no `application`;
- Resolução única dos IDs de recurso via `aapt2 dump resources`,
  sem supor nomes físicos constantes em `res/*.xml`;
- Arquivos XML regulares, únicos, não vazios e com tamanho limitado
  dentro do ZIP APK;
- Para Android 12+, `cloud-backup` e `device-transfer`, ambos
  com **nove exclusões**, sem regras `include`, duplicatas ou
  subcaminhos parciais;
- Para backup legado, `full-backup-content` com as mesmas nove
  exclusões completas, incluindo `path="."`;
- `disableIfNoEncryptionCapabilities=true` na regra de nuvem,
  sem atributos desconhecidos;
- Rejeição de valores ambíguos, resource IDs trocados, caminhos
  malformados, XML duplicado, exceções inesperadas e falhas do `aapt2`.

## Verificação independente em testes

`tests/android-publish-compiled-backup-xml.test.mjs` retira o
Python diretamente do **passo que seria executado pelo publicador**,
roda-o contra APKs sintéticos e inspeciona omissões, duplicatas,
alterações de domínio, `include`, criptografia desligada e
identidades de recurso alteradas.

Um teste compara esse código incorporado com o verificador offline
revisado, exigindo equivalência literal exceto pela ordem dos
argumentos do modo inline.

**Limites:** a branch executa o código de verificação sob testes
simulados. O job privilegiado continua condicionado a despacho
manual autorizado na `main`. Não houve publicação real.
A checagem dos XMLs não substitui testes físicos em diferentes
versões Android e aparelhos/OEM.

Gates: testes Node, CI Android 9/9, compilação do APK de
laboratório, publicador SKIPPED e revisão humana antes do merge.
