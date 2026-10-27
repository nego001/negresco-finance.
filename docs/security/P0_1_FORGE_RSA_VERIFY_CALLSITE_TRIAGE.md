# P0-1 | Triagem das chamadas de verificação RSA no host Expo

**Laboratório Draft empilhado sobre a PR #90, sem merge ou release.**

A [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
atinge a verificação de assinaturas RSA PKCS#1 v1.5 por
`node-forge`, ao aceitar filhos adicionais dentro da sequência ASN.1
`DigestAlgorithm`.

Os anteriores 3+1 imports de Forge e as contagens `.verify()` não
distinguiam verificações de chaves públicas de outros métodos.
Este experimento **somente inspeciona texto** nos pacotes npm instalados
com o lock reproduzível. Classifica padrões `publicKey.verify()`,
`certificate.verify()`, `csr.verify()` e indicadores de import
de Forge no mesmo arquivo. Gera IDs SHA-256 opacos de arquivos
candidatos e SHA-256 do seu conteúdo, sem nomes de fonte, trechos,
material criptográfico ou mapas.

O segundo job reinstala todos os pacotes em runner isolado com
`npm ci --ignore-scripts` e recalcula completamente o relatório.
O APK e as verificações já existentes permanecem intactos.

## Sem alegações indevidas
- Presença de `publicKey.verify()` é apenas **candidato** a análise
  manual de fluxo. Não prova que execute num comando Expo ou use
  RSA PKCS#1 v1.5 com chave de expoente baixo.
- Ausência desse texto não descarta aliases, código compilado de
  outras formas, caminhos dinâmicos ou validação de certificado.
- `certificate.verify` pode chamar verificações internas, mas
  isso não é comprovado por esta pesquisa lexical.
- Nenhuma assinatura, exploit, chave privada ou certificado de
  produção é criado ou processado.
- GHSA e os cinco alertas HIGH bloqueiam a versão estável.

A liberação exige correção oficial ou alternativa suportada,
reconstrução do grafo npm e revisão humana. Sem atalhos.
