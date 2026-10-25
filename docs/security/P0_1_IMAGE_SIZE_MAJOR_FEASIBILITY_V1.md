# P0-1 | Compatibilidade da correção image-size v2 (laboratório)

PR DRAFT baseada na #73, sem merge, publicação, secrets ou
alteração de dependências versionadas.

## Diagnóstico factual

A árvore npm da #73 mantém seis avisos HIGH após a correção
PostCSS. Entre eles `image-size@1.2.1` é afetado por
`GHSA-5p2g-fcmc-qvqq`. O advisory revisado indica
correção na versão **2.0.3**. É um salto de major (`1.x`
para `2.x`) que pode alterar APIs usadas pelo Expo SDK 54.

`node-forge@1.4.0` também está vulnerável, mas o advisory
`GHSA-86w9-cpqp-85rv` não apresenta versão npm corrigida.
Este experimento **não** tenta disfarçar esse risco.

## Experimento

Workflow isolado `.github/workflows/image-size-major-lab.yml`,
executado exclusivamente por push na branch de laboratório,
com `contents: read` e sem secrets:

1. Gera lockfile base usando apenas `postcss: 8.5.23`.
2. Em runner descartável, adiciona também
   `image-size: 2.0.3` e gera novo lockfile; nenhum script
   de instalação roda durante a resolução.
3. Consulta `npm audit` sobre ambas as árvores e rejeita
   falhas de consulta, piora de advisories e mudanças em
   `expo`, `expo-updates`, `react`, `react-native`,
   `postcss` e `node-forge`.
4. Exige que as mudanças do lockfile sejam restritas a
   `image-size`. Registra hashes criptográficos e publica
   artefato de comparação marcado **NÃO REVISADO**.
5. Job separado baixa o candidato da mesma execução,
   confere seu SHA-256 e executa `npm ci`, `tsc` e
   `expo prebuild` sem compilar APK e sem publicar.

## Limites

Mesmo que o experimento reduza o número de avisos, isso
não comprova compatibilidade nativa completa, segurança
de runtime nem ausência de vulnerabilidades. Pode falhar
devido à mudança de API do image-size v2; uma falha deve
ser corrigida conscientemente, nunca contornada ignorando
dependências.

São necessárias revisão independente, testes Android
instrumentados, assinatura OTA real e tratamento das
demais vulnerabilidades antes de qualquer release estável.
