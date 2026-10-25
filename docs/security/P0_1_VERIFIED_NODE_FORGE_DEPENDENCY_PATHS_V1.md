# P0-1 | Caminhos reais que introduzem node-forge no npm

PR **DRAFT** empilhada sobre #78, sem alterar dependências
do aplicativo, sem merge na `main` nem publicação.

## Evidência

O APK de laboratório da #78 contém um lockfile npm auditável,
SBOM CycloneDX (746 componentes) e ledger de cinco avisos HIGH.
O pacote `node-forge@1.4.0` está relacionado ao advisory
`GHSA-86w9-cpqp-85rv`.

O npm audit indica cinco pacotes afetados, porém ainda é
necessário demonstrar diretamente, a partir do lockfile,
**como a dependência vulnerável chega ao projeto**.

## Novo relatório determinístico

O `verify_node_forge_dependency_paths.cjs` reconstitui a
resolução física de `node_modules` para cada dependência
declarada no lockfile. Ele exige, com as versões reais
resolvidas, três caminhos:

1. `@negresco/mobile → expo → @expo/cli → node-forge`
2. `@negresco/mobile → expo → @expo/cli →
   @expo/code-signing-certificates → node-forge`
3. `@negresco/mobile → expo-updates →
   @expo/code-signing-certificates → node-forge`

Gera `NODE_FORGE_DEPENDENCY_PATHS.json` com caminhos,
versões npm instaladas, especificações das dependências
e hashes SHA-256 do lockfile, SBOM e ledger.

Bloqueia reportar versão supostamente corrigida de
`node-forge` sem evidência, remover caminho direto de Expo,
alterar os arquivos de entrada, forjar `productionApproved`,
ou acrescentar/remover relações sem revisão.

O job independente de auditoria do APK baixado recalcula
os três caminhos diretamente do lockfile e compara
todo o arquivo de evidência byte a byte, antes das checagens
de assinatura Android e OTA `preview`.

## Limites importantes

**Alcançável na árvore de dependências npm não equivale a
alcançável durante a execução do APK Android.** O pacote
`@expo/cli` pode ser usado em tarefas de build, e este
relatório não demonstra que o motor Hermes incluiu
`node-forge`, que os usuários executem o código vulnerável
ou que a rota de certificados esteja exposta em runtime.

Por outro lado, a ausência de prova de execução tampouco
autoriza esconder o advisory. Faltam análise do bundle,
investigação do uso de assinatura e avaliação independente.

O npm continua a registrar **cinco HIGH** e a política
de release estável permanece **BLOQUEADA**.
