# P0-1 | Classificação de APIs criptográficas nas ferramentas Expo do host

**PR Draft de laboratório empilhada sobre a PR #89**. Escopo
isolado para compreensão do advisory GHSA-86w9-cpqp-85rv.

## Método

Usa os **dois mesmos `npm ci --ignore-scripts` independentes** da PR #89.
Além dos imports de `node-forge`, um scanner textual examina referências
a APIs conhecidas de `forge.pki` (certificados, chaves, CSR),
`forge.md.sha256`, `forge.asn1` e métodos genéricos `.sign()` /
`.verify()`. O segundo runner **recalcula tudo** com pacotes instalados
novamente e compara bytes, versões, SHA-256 das árvores de fontes e do
inventário anterior. Sem execução de chaves, geração de certificados ou
assinaturas, e sem exportação de fontes/trechos.

`HOST_FORGE_CRYPTO_API_CENSUS.json` contém apenas contagens por pacote,
lista fechada de classes de API e hashes; `stableReleaseAllowed=false`.

## Interpretação e limitações

- Expressões `.verify()` e `.sign()` são genéricas e **podem não
  ter relação com o forge**. Não são chamadas observadas em execução.
- Análise lexical pode incluir comentários e código não executado,
  e pode não detectar aliases dinâmicos ou chamadas indiretas.
- Mesmo referência a `certificateFromPem` não comprova que a falha
  específica no verificador RSA PKCS#1 v1.5 seja alcançável.
- Dependências instaladas no host podem representar risco mesmo que não
  sejam incluídas no APK. Os cinco avisos HIGH persistem.
- Nenhum resultado deste experimento é critério suficiente para
  publicação ou fechamento da issue #83.

A compilação APK e verificações de segurança existentes permanecem
intactas. A PR é apenas pesquisa de superfície de API.
