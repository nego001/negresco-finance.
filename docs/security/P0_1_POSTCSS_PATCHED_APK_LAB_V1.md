# P0-1 | APK completo com PostCSS transitivo corrigido (laboratório)

Esta PR é empilhada sobre #72 e executa exclusivamente nas branches de
laboratório. **Não adiciona overrides ao manifesto versionado e não
publica APK na loja ou GitHub Releases.**

## Objetivo

O experimento da #72 demonstrou que `postcss@8.5.23` reduz de oito
para seis os advisories conhecidos do grafo (restam seis HIGH).
O smoke anterior validou `npm ci`, `tsc` e geração Expo prebuild,
mas não comprovava que o app compila nem que seu APK contém a mesma
política OTA.

## Testes adicionais no workflow

O workflow `postcss-advisory-lab.yml` é restrito às branches
`lab/p01-postcss-patch-feasibility-v1` e
`lab/p01-postcss-patched-apk-v1`. Na segunda, a CI também:

- recebe o mesmo lockfile candidato do job comparativo da execução,
  valida SHA-256 e restringe a diferença do lockfile ao PostCSS;
- aplica o override **somente no diretório efêmero do runner**;
- executa `npm ci`, TypeScript e `expo prebuild`;
- configura Gradle no runner, proíbe keystore estável, executa
  `assembleRelease` utilizando apenas a assinatura de teste Android;
- valida ZIP, `apksigner`, superfície do APK, `runtimeVersion` compilada
  3.1.3, manifesto Expo Updates compilado com `preview` e
  `assets/app.config` incluído no mesmo APK;
- registra SHA-256 e publica o APK como artefato temporário
  `postcss-lab-debug-signed-apk-unreviewed`, por 3 dias;
- em job **separado, somente leitura**, baixa o APK e o manifesto
  da mesma execução, confere caminho e SHA-256 canônicos e
  repete verificações da assinatura e de configuração OTA compilada.

O workflow não tem eventos `workflow_dispatch`, permissões de
publicação, secrets de assinatura nem operação de release.
Testes de contrato verificam essas condições.

## Limites

O APK compilado é um **artefato de teste, não um release estável**.
Esta etapa não comprova ausência de vulnerabilidades no pacote:
seis advisories HIGH permanecem conhecidos. Também não demonstra
OTA remota assinada, segurança do código executado pelo Hermes,
instalação em aparelho físico, nem compatibilidade de todos os
fluxos financeiros. O sucesso do Gradle é apenas mais uma evidência
de compatibilidade incremental.

A revisão independente e a resolução dos avisos críticos para o
modelo de segurança permanecem pré-requisitos da publicação.
