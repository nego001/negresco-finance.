# P0-1 | node-forge 1.4.2: supply chain e compatibilidade PEM

Laboratório **Draft**, empilhado sobre a PR #94, sem impacto na `main`, sem APK nem publicação.

## Mudança upstream

- Tag anotada oficial `digitalbazaar/forge v1.4.2` aponta para o commit `7928054627d93ab8c0216b756246e8ca8d62a93e`.
- O diff de `v1.4.1` para `v1.4.2` altera somente `CHANGELOG.md`, `package.json`, `lib/pem.js` e o teste de `pem.decode(Buffer)`.
- `lib/rsa.js` não mudou no diff Git; o reforço DER RSA introduzido em 1.4.1 segue sendo verificado.
- O changelog aponta que a 1.4.2 restaura a conversão `String(str)` para entradas `Buffer` após uma regressão de compatibilidade na 1.4.1.

## Gates implementados

- Resolver a dependência transitiva via npm para 1.4.2, sem `override` no manifesto original e sem executar scripts no `npm ci`.
- Comparar SHA-512 do tarball npm com `integrity` do lock temporário, nome/versão e grafo da cadeia Expo.
- Comparar os **dois** arquivos instalados `lib/rsa.js` e `lib/pem.js` byte a byte contra o commit oficial imutável.
- Conferir invariantes do código DER em RSA, a presença da conversão PEM e o retorno de `pem.decode(Buffer)` em exemplo **sintético** não sensível.
- `npm audit --json --package-lock-only` sem supressão e com bloqueio se houver qualquer achado.
- Segundo runner: reinstalar o lock exato, repetir npm pack e consulta à fonte Git, executar novamente o caso `Buffer`, reproduzir relatório JSON byte a byte.
- Guardar apenas manifesto, lock, `audit.json` e relatório agregado de hashes: **não** guardar tarball, fontes ou APK nos artifacts.

## Limites

Conferir o código e a compatibilidade de parser não é auditoria criptográfica completa, não envolve chaves reais nem conteúdo PEM não confiável, e não comprova que o APK Android está seguro. A tag Git é anotada mas não possui assinatura Git verificada no endpoint consultado, portanto a confiança na origem exige cautela. Esta PR jamais libera produção sozinha. `stableReleaseAllowed=false` permanece obrigatório; revisão humana e Android/OTA ficam pendentes.
