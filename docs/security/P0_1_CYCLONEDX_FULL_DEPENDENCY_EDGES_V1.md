# P0-1 | CycloneDX 1.6 com grafo npm resolvido (laboratório)

PR DRAFT empilhada sobre #79. Não modifica dependências
do aplicativo, a `main`, a política OTA ou as permissões
de publicação.

## Problema

O SBOM existente inventaria 746 pacotes npm e seus hashes
SHA-512, mas não inclui as conexões de dependências.
Sem as conexões, um leitor não consegue determinar os caminhos
entre bibliotecas a partir do próprio CycloneDX.

O lockfile candidato analisado nesta etapa contém:
- **746 componentes npm**;
- **1.456 declarações de dependência resolvidas** entre
  produção, opcionais, desenvolvimento e peers instalados;
- **11 declarações de peerDependencies sem pacote instalado**.
  Não são silenciosamente transformadas em componentes.

Os números acima foram obtidos do lockfile real do APK de
laboratório; não significam 1.456 bibliotecas diferentes,
nem comprovam quais pacotes são executados no Android.

## Mudança

`tooling/android/npm_lock_cyclonedx_sbom.cjs` passa a
produzir a seção padronizada `dependencies` CycloneDX
para a aplicação raiz e cada biblioteca `npm-lock:`,
resolvendo nomes via hierarquia `node_modules` como
o Node/npm fazem.

- Cada componente ganha relações `dependsOn` para
  componentes resolvidos, com referências válidas
  e determinísticas.
- Dependências diretas, de desenvolvimento, opcionais
  e peers instalados participam do grafo. Relações
  duplicadas de mesmo destino são deduplicadas.
- Declarações de peers **sem instalação** ficam explícitas
  nas propriedades `negresco:unresolved-peer-count`
  e `negresco:unresolved-peers-json`, incluindo se o
  peer foi marcado opcional pelo manifesto.
- Qualquer dependência **não-peer** sem resolução,
  nome inválido, faixa malformada ou metadata inválida
  interrompe a geração.
- O SBOM permanece determinístico, sem timestamps,
  sem UUID aleatório e com SHA-256 do mesmo lockfile.

O workflow experimental da #79 já chama o gerador no
APK de teste e exige, em job de auditoria independente,
que o SBOM baixado corresponda **byte a byte** ao SBOM
recalculado do lockfile exato. Ele continua passando
por checksum, proveniência, ledger de cinco HIGH,
mapeamento node-forge e auditoria OTA compilada.

## Segurança e limites

O campo `dependsOn` representa **declarações npm resolvidas**.
Uma dependência peer pode ser obrigação de integração e
uma dependência dev pode ser utilizada apenas pelo bundler.
Esses arcos **não provam execução de código no APK**.

Peers ausentes não são classificados automaticamente
como vulnerabilidades, nem a existência de caminhos
autoriza ignorar advisories. Continuam os cinco
avisos HIGH da cadeia `node-forge` / Expo,
OTA preview sem assinatura e necessidade de
revisão independente antes de release estável.
