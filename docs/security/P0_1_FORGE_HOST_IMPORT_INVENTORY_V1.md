# P0-1 | Importações literais do node-forge no ambiente de build

**Experimento Draft em branch isolado empilhado sobre a PR #88**.
O inventário do APK/Hermes não é suficiente para avaliar bibliotecas que
as ferramentas Expo podem carregar durante `npm ci`, `expo prebuild` ou
outras tarefas do host. Esta etapa inspeciona arquivos JS/TS **realmente
instalados** para as versões fixadas no lock experimental.

## Método
- Staging de `package.json` e lockfile temporários com os hashes do
  comparativo já validado (sem sobrescrever a configuração versionada).
- `npm ci --ignore-scripts --no-audit --no-fund` em dois runners Ubuntu
  descartáveis com Node 22.16.0; instalação sem executar scripts npm de
  postinstall. A auditoria npm existente continua **sem supressão**.
- Varredura somente leitura de `expo`, `expo-updates`, `@expo/cli`,
  `@expo/code-signing-certificates` e `node-forge`, incluindo versões
  aninhadas do lock. Fonte protegida contra links simbólicos, arquivos
  gigantes e traversal. Apenas contagens de referências textuais e padrões
  lexicais de `require`/`import`, além de hashes da árvore fonte, são
  gravados em `HOST_FORGE_IMPORT_INVENTORY.json`.
- Segundo job em runner independente repete a instalação sem scripts e
  **recalcula o relatório completo**, comparando bytes com o arquivo
  baixado. Diferente dos inventários Metro anteriores, esta reauditoria
  pode recalcular as contagens porque usa os pacotes publicados novamente.
- Artifact temporário **somente JSON agregado**. Nada de fontes, trechos
  de código ou credenciais. `contents: read`.

## Limites
Presença de `require('node-forge')` num arquivo distribuído é indício de
**possível caminho de execução**, não prova que o comando efetivamente
chame a rotina RSA vulnerável. Ausência de imports lexicais não elimina
carregamento dinâmico, reexportação, artefatos gerados ou vulnerabilidades
em outras ferramentas. A vulnerabilidade GHSA-86w9-cpqp-85rv continua
aberta e **não há autorização para release estável**.

O escopo do relatório não inclui testes de exploração, nem executa
assinaturas reais com materiais de produção. Nenhum patch criptográfico
será criado sem revisão upstream.
