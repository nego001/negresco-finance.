# P0-1 | Npm lockfile obrigatorio antes de build estavel

PR **DRAFT** empilhada sobre #68. Sem merge na main, sem release,
sem certificado privado, sem instalacao de dependencias em
laboratorio adicional.

## Risco observado

O pacote `apps/mobile/package.json` tem dependencias semver
(`~54.0.0`, `~29.0.0`, etc.). Ate esta etapa **nao havia
`apps/mobile/package-lock.json` versionado**. O workflow do
Android executava `npm install --no-audit --no-fund`, que pode
resolver versoes transitivas diferentes para o mesmo commit.

A verificacao de OTA no APK compilado nao garante a
reprodutibilidade das bibliotecas e do codigo que entraram nele.

## Gate adicionado

- A execucao de laboratorio `push` e `pull_request` continua
  usando `npm install`, sem exigir um lockfile inexistente.
- Um disparo `workflow_dispatch` na `main` que solicite
  `stable_signing` **ou** `publish_release` passa **antes da
  instalacao e dos segredos de assinatura** pelo comando
  `node ../../tooling/android/verify_stable_npm_lock.cjs package.json package-lock.json`.
- Uma build estavel so instala bibliotecas apos passar no gate,
  com `npm ci --no-audit --no-fund` e nao `npm install`.
- O gate exige lockfile npm versao 3 regular, seguro e de
  tamanho limitado, identidade/versionamento do pacote consistentes,
  dependencias diretas e de desenvolvimento identicas ao manifest,
  registros dos pacotes diretos, e todos os pacotes transitivos
  em URLs `https://registry.npmjs.org/` com integridade `sha512`.
- Bloqueia links locais, URLs Git ou HTTP, hosts falsos, referencias
  relativas ou com travessia de diretorios, registros duplicados
  em JSON, falta de hashes e lockfiles adulterados/ausentes.
- `tests/android-stable-npm-lock-gate.test.mjs` exercita o
  verificador standalone e comprova a separacao dos comandos
  do workflow.

## Status e acao necessaria

**A build estavel continuara BLOQUEADA** enquanto o lockfile real
nao for gerado, versionado, auditado e testado. Isto e intencional:
NAO estamos fabricando uma arvore de dependencias nem dizendo que
uma lista arbitraria de hashes corresponde ao APK.

Para desbloquear no futuro, um mantenedor deve resolver as
dependencias a partir de um ambiente controlado com Node/npm fixos,
revisar pacotes/artefatos e licencas, versionar o lockfile obtido e
validar `npm ci` em CI com o grafo revisado. Considerar tambem
pinning de actions GitHub/Gradle/SDK e proveniencia independente;
este gate sozinho **nao** prova reproducibilidade de APK bit a bit.

## Limites

Esta etapa so audita a resolucao declarada do NPM e muda a via
de instalacao para **futuros releases estaveis**. `npm ci` ainda
executa scripts de instalacao dos pacotes quando presentes;
testes de malware, dependencias nativas Gradle, Code Signing OTA
e comparacao de builds reproduziveis continuam fora do escopo.
O app `preview` segue com OTA sem assinatura e NAO foi publicado.
