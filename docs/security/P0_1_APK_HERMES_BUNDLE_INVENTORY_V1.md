# P0-1 | Integridade do bundle Hermes realmente empacotado

**PR Draft empilhada sobre #82.** O aplicativo React Native não é somente
DEX e `.so`: parte importante de sua lógica chega ao Android por
`assets/index.android.bundle`, compilado pelo Hermes.

## Evidência verificável
Depois da build experimental, o workflow executa
`apk_hermes_bundle_inventory.py capture` no **mesmo APK** cujo SHA foi
associado à dependência Gradle e aos arquivos DEX/.so pela PR #82.

Gera `APK_HERMES_BUNDLE_INVENTORY.json` com:
- SHA-256 do APK, do inventário nativo e do próprio bundle Hermes;
- caminho canônico, tamanho descompactado e versão de bytecode Hermes;
- SHA do commit e `approvedForProduction: false`;
- marcador explícito `NOT JS MODULE REACHABILITY`.

O parser exige entrada ZIP única, arquivo regular sem criptografia,
magic bytes Hermes e versão estrutural plausível. Um job **read-only**
baixa os artefatos novamente e rederiva o JSON byte a byte
antes da auditoria OTA compilada.

## Amostra real anterior
No APK já aprovado da PR #82, `assets/index.android.bundle` apresentou
1.157.668 bytes, Hermes v96 e SHA-256
`0f53173138d2d1d645e8628d9d8d028db48aac82195441c47ffe2add8bfcf6dc`.
A verificação `capture` / `verify` passou localmente contra o APK e
inventário nativo reais. A nova PR deve reproduzir esse processo no CI
com um commit e APK novos.

## Limites
**Não demonstra que `node-forge` está ausente nem que uma função
vulnerável é inalcançável.** Bytecode minificado/obfuscado não
preserva necessariamente nomes de módulos. Para concluir alcance,
é necessário rastrear módulos do Metro/source maps e avaliar
as chamadas criptográficas com revisão independente.

Cinco pacotes sinalizados HIGH continuam registrados, mesmo quando
derivam de um único advisory primário; não libera OTA ou stable.
Nenhuma mudança em `main`, dependências de produção ou secrets.
