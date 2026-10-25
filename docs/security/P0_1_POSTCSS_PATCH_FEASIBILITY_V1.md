# P0-1 | Experimento isolado de correção PostCSS

Este estudo é **somente de laboratório** e não muda o APK,
o `apps/mobile/package.json` versionado ou a publicação.

## Diagnóstico inicial

O candidato real de lockfile do Negresco Finance SDK 54 possui
`postcss@8.4.49`, `image-size@1.2.1` e
`node-forge@1.4.0`. O npm audit reportou sete avisos HIGH e
um MODERATE no grafo inteiro.

A correção do aviso PostCSS
`GHSA-fxqj-rqcc-2cmp` foi publicada em `8.5.23`.
Por outro lado, os advisories consultados de `node-forge`
(`GHSA-86w9-cpqp-85rv`) e `image-size`
(`GHSA-5p2g-fcmc-qvqq`, `GHSA-w3rx-r6r6-pgpr`)
não fornecem uma versão npm corrigida e publicada que possa ser
aplicada com segurança neste momento.

## Experimento

`.github/workflows/postcss-advisory-lab.yml` executa apenas
quando a branch `lab/p01-postcss-patch-feasibility-v1`
recebe um push:

1. Regenera um lockfile baseline com Node 22.16.0 e npm,
   sem scripts de instalação.
2. Obtém JSON de advisories do registry oficial.
3. Na cópia descartável do runner, adiciona
   `"overrides":{"postcss":"8.5.23"}` ao manifesto.
4. Gera um **segundo** lockfile, também sem scripts de
   instalação, e consulta o npm audit.
5. Compara versões de `expo`, `expo-updates`, `react` e
   `react-native`; recusa alterações desses pacotes.
   Confere que todas as cópias de PostCSS estão em 8.5.23,
   que os avisos de HIGH/CRITICAL/TOTAL não cresceram e
   que o diff do grafo não ultrapassou o limite.
6. Publica somente o par de lockfiles, relatórios npm e o
   `POSTCSS_PATCH_FEASIBILITY.json` com hashes e
   `reviewed:false`, por sete dias.

O job `compare-review-only` **não instala pacotes**. Um segundo
job independente `smoke-patched-expo`, após a comparação, baixa o
artefato da mesma execução, confere o SHA-256 do candidato,
instala com `npm ci` em runner efêmero **sem secrets**, executa
`npx tsc --noEmit` e `npx expo prebuild --platform android`
para verificar geração do projeto nativo. Não cria ou assina APK,
não roda Gradle, não publica releases nem faz merge.

O primeiro ensaio do run `40213164947` confirmou PostCSS
`8.4.49 -> 8.5.23` com **apenas um pacote do lockfile alterado**,
e avisos npm de **8 (7 high + 1 moderate) para 6 (6 high)**.
Esse resultado precede o smoke com `npm ci` e não o substitui.

## Interpretação

Este é um teste de **resolução transitiva e advisories**, e
não um sinal verde de compatibilidade Android. Mesmo que o npm
reduza avisos com esse override, ainda faltarão revisão de
licenças/scripts/cadeia de dependências, instalação travada
com `npm ci`, testes instrumentados e OTA assinada.

Pacotes sem versão segura publicada não devem ser substituídos
por versões fictícias nem ter vulnerabilidades ocultadas. A
release estável continuará bloqueada pelo gate da PR #71.
