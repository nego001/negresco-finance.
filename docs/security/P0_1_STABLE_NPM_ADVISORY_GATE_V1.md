# P0-1 | Bloqueio de advisories npm antes de assinatura estável

PR DRAFT empilhada sobre #70. Sem merge na main, sem release, sem
secrets de produção habilitados e sem alterar versões do Expo.

## Evidência concreta

O lockfile candidato gerado no workflow da #70 corresponde a
**747 dependências** e foi acompanhado de relatório `npm audit`
com **8 vulnerabilidades conhecidas: 7 high, 1 moderate,
0 critical**. Dois dos pacotes atingidos são dependências
diretas `expo` e `expo-updates`; outros incluem
`@expo/cli`, `@expo/code-signing-certificates`,
`@expo/metro-config`, `image-size`, `node-forge` e
`postcss`.

A sugestão automática de correção do npm envolve versões Expo
incompatíveis/downgrades em alguns casos. Não usar
`npm audit fix --force` sem homologação Android.

## Implementação

O workflow `android-apk.yml` em `workflow_dispatch` manual
na `main` com `stable_signing` ou `publish_release`:

1. Primeiro exige um `package-lock.json` v3 revisado
   e passa pelo verificador offline da #69.
2. **Antes de npm ci, da build e de disponibilizar segredos
   de assinatura**, consulta o registry npm oficial com
   `npm audit --json --package-lock-only`.
3. `tooling/android/verify_stable_npm_audit.cjs` rejeita JSON
   ausente/malformado, erro de consulta e contagens inconsistentes;
   exige `auditReportVersion=2` e coerência entre avisos e
   metadados.
4. **Qualquer advisory conhecido**, inclusive low/info,
   impede a release até triagem/correção; mesmo zero avisos
   não dispensa revisão humana.
5. Somente após os dois gates e a confirmação de que o
   comando npm terminou sem erros a CI permite `npm ci`.

A versão de laboratório continua com `npm install` e não
ativa consulta de releases estáveis. O publicador privilegiado
continua condicionado ao disparo manual autorizado e aos demais
gates de assinatura, runtime OTA e APK.

## Testes e limites

`tests/android-stable-npm-advisory-gate.test.mjs`
testa aprovação de resposta limpa sintética, 7 high + 1 moderate,
falhas de rede/relatório, indicadores falsificados, symlinks,
arquivo muito grande e posição obrigatória do gate antes
de instalar dependências ou acessar chaves.

Este controle captura avisos conhecidos no instante da consulta.
**Não garante ausência de malware**, bugs ainda não reportados,
integridade da cadeia Gradle/Android ou reprodução bit a bit do APK.
A PR também não conserta as vulnerabilidades do candidato. O
projeto permanece bloqueado para publicação estável enquanto
essas ocorrências não forem tratadas e testadas.
