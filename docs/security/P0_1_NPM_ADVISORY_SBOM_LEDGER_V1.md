# P0-1 | Advisory npm ↔ SBOM ↔ lockfile ↔ APK

Esta PR **DRAFT** empilhada sobre #77 mantém todas as alterações
fora da `main` e não autoriza publicação estável.

## Motivação

A #77 validou o SBOM npm com **746 componentes** e seus hashes
SHA-512 contra o lockfile exato do APK experimental. O relatório npm
deste mesmo candidato registrou **5 vulnerabilidades HIGH**
interligadas:

- `node-forge`: origem direta da cadeia de avisos, incluindo
  `GHSA-86w9-cpqp-85rv` para a versão instalada 1.4.0.
- `@expo/code-signing-certificates` e `@expo/cli`: dependências
  transitivas afetadas pelo `node-forge`.
- `expo-updates` e `expo`: dependências diretas marcadas pelo
  npm por propagação da cadeia transitiva.

Os cinco são **pacotes apontados como vulneráveis**, não prova de
cinco falhas independentes exploráveis no APK.

## Novo controle

`tooling/android/npm_audit_sbom_ledger.cjs` implementa
`capture` e `verify`. Usa os **mesmos bytes** do
`package-lock.json`, `image-size-candidate-audit.json`,
`IMAGE_SIZE_MAJOR_FEASIBILITY.json` e
`NPM_BUILD_GRAPH_CYCLONEDX.json`.

O resultado `NPM_ADVISORY_LEDGER.json` inclui:
- hashes SHA-256 dos quatro arquivos que geraram o registro;
- severidade, cadeia `via`, dependências afetadas, advisory GHSA;
- caminhos e versões exatas dos componentes apontados, comprovados
  pela árvore do lockfile e pelo inventário CycloneDX;
- contagens coerentes com o `npm audit` e status
  `productionApproved: false`.

Bloqueia alterações de severidade, entradas órfãs, relatório vazio,
dependência não encontrada no SBOM, GHSA trocado, ligações transitivas
não verificadas, hashes divergentes e arquivos malformados/links.

O workflow armazena o relatório bruto npm e o novo ledger dentro
do artifact do APK de laboratório. O job read-only de auditoria
refaz as mesmas verificações a partir do conteúdo baixado,
**antes de inspecionar o manifesto Android e o runtime OTA**.

## Restrições

O novo registro **não resolve vulnerabilidades** e não deve
suprimir os avisos para atingir cinco, zero ou qualquer outra
contagem. A fotografia de cinco HIGH é a evidência do experimento
específico e qualquer alteração exige revisão humana.

Uma versão segura futura do `node-forge`, alteração sustentada
pelo Expo ou mitigação comprovada exigirá novo lockfile, auditoria
npm atualizada, novo SBOM, testes em emulador e APK compilado.
As mensagens do npm `fixAvailable` que sugerem downgrade Expo
não autorizam downgrade major automático.

Este ledger não é um atestado SLSA assinado, não cobre
Gradle/JNI nem atesta execução segura, e não substitui
assinatura de código OTA de produção.
