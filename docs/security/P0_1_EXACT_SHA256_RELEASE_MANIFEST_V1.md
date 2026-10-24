# P0-1 | Manifesto SHA-256 estrito antes da publicação

Esta revisão de laboratório protege o job de publicação da release
Android. Nenhum APK é publicado, a `main` permanece intacta e
as políticas/credenciais administrativas não são modificadas.

## Por que alterar

O job privilegiado executava `sha256sum -c SHA256-release.txt` em
um manifesto transferido como artefato do job de build. O comando
`sha256sum -c` segue os **nomes de arquivos escritos no próprio
manifesto**, não apenas os arquivos que o workflow pretende verificar.
Sem uma lista previamente validada, o manifesto poderia conter
caminhos arbitrários, repetidos ou extras.

## Verificação implementada

A etapa `Verify downloaded candidate contents before publication`
executa um **validador Node inline** no próprio job privilegiado,
antes de chamar `sha256sum --strict --check`. Isso evita incluir
um script fornecido pelo artefato ou fazer checkout de código não
auditado no processo de publicação.

O validador exige:

- Exatamente cinco arquivos normais, não vazios e sem links
  simbólicos na pasta transferida: APK, ZIP, relatório do
  certificado, manifesto SHA256 e notas de release;
- Manifesto com **exatamente três registros**, um para APK, um
  para ZIP e um para o relatório da assinatura, na ordem gerada
  pelo build;
- Cada registro deve conter 64 caracteres hexadecimais minúsculos,
  dois espaços e somente o nome literal autorizado;
- Uma quebra de linha LF final e ausência de NUL, CR, entradas
  adicionais, duplicações, nomes absolutos e `../`;
- Tamanho máximo de 4 KiB do manifesto; o `sha256sum --strict`
  faz a comparação real de todos os digests após essas verificações.

Os nomes e a ordem correspondem diretamente ao comando do build
`sha256sum APK ZIP APK-SIGNATURE.txt > SHA256-release.txt`.

## Segurança mantida

A inspeção do certificado `apksigner`, identidade do ZIP,
verificação SHA256 dos quatro ativos pela API REST, bloqueio de
publicação fora de `main`, releases imutáveis e auditoria final
permanecem em vigor.

Nenhuma regra permissiva foi introduzida para erros de checksum.
O manifesto é validado antes de permitir que `sha256sum -c`
abra qualquer caminho listado.

## Testes

A suíte Node executa o **script Bash real extraído do workflow**
sobre arquivos temporários sintéticos, sem APK real e sem GitHub
API. Verifica manifesto válido e rejeição de duplicatas, travessia
de diretórios, caminhos absolutos, reordenação, hashes falsificados,
manifestos grandes/malformados, arquivos extras ou ocultos, links,
arquivos faltando/vazios, diretórios indevidos e modificação de APK
após produzir o manifesto.

A CI Android e o APK do commit final ainda devem passar antes
de qualquer integração.
