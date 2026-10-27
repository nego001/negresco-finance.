# P0-1 | Verificação de procedência do node-forge 1.4.1

## Motivo
Em 27/10/2026, a resolução npm passou espontaneamente para
`node-forge@1.4.1`. O fluxo antigo **bloqueou** a compilação porque esperava
`1.4.0` e cinco HIGH. A tag anotada `v1.4.1` do repositório oficial
`digitalbazaar/forge` aponta para o commit
`8a917370ec51731e817c2d547b7329a58f8210af`.
Seu changelog documenta correção CVE-2026-85393 e outras questões.

Este laboratório Draft independente confere:
- o **tarball npm** `node-forge@1.4.1` com o SHA-512 do lockfile novo;
- o `lib/rsa.js` instalado com o **mesmo arquivo** no commit oficial imutável;
- a existência da regra de codificação canônica DER no código, sem executar
  verificações RSA ou explorar falhas;
- a árvore Expo pinada, 0 advisories no snapshot e toda a origem por hash;
- um segundo runner, com `npm ci --ignore-scripts`, que refaz o procedimento
  e verifica o relatório byte a byte.

**Limites:** `npm audit=0` é um snapshot, não garantia de ausência de
vulnerabilidades novas ou não publicadas. Uma fonte correspondente à tag não
equivale a auditoria de criptografia, de entrada PEM, de aplicação Android ou
aprovação de release. Não altera produção nem gera APK; dados publicados:
somente lockfile e JSON de evidência agregada.
