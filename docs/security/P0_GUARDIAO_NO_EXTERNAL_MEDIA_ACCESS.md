# P0 | Android sem acesso à mídia e armazenamento externo (laboratório)

## Justificativa e baseline

A inspeção de `AndroidManifest.xml` compilado de três APKs anteriores (PRs #97, #99, #101) provou identidade byte-a-byte do manifesto SHA-256 `38f82fade6fadea4a05223abaf412d11d68b29a407d1a0ddf528528a95f11d05`. **Todos** ainda declaram `READ_EXTERNAL_STORAGE` com `maxSdkVersion=32` e `READ_MEDIA_IMAGES` com `minSdkVersion=33`/`maxSdkVersion=33`, ainda que já removam `WRITE_EXTERNAL_STORAGE` e `SYSTEM_ALERT_WINDOW`.

A função Guardião PDF atualmente gera PDF na pasta privada de cache `cache/Print/<UUID>.pdf`, usa `Sharing.shareAsync` e limpa apenas arquivos temporários privados ainda não compartilhados. Esse fluxo não requer ler mídias de armazenamento externo. Apesar disso, **a ausência de uso no fluxo analisado não demonstra ausência de outros usos**. Esta PR testa a remoção e mantém veto a produção até regressões funcionais.

## Alterações

- Acrescenta `android.permission.READ_EXTERNAL_STORAGE` e `android.permission.READ_MEDIA_IMAGES` à lista `android.blockedPermissions` exclusivamente na branch experimental.
- Estende verificador que lê o binário AXML do APK, bloqueando as quatro permissões proibidas, preservando `INTERNET` e `USE_BIOMETRIC`.
- Amplia fixtures negativas do manifesto e verificações de contrato da interface Guardião.
- Audita o APK baixado de forma independente via `aapt dump permissions` no segundo runner.

## Gates

- [ ] Testes de contrato e tipos Expo SDK 54, incluindo fixtures negativas para as quatro permissões.
- [ ] Gradle compile e APK assinado apenas com Android Debug; manifesto real não pode declarar nenhuma das quatro permissões proibidas.
- [ ] Reauditoria de APK baixado, OTA preview, rede/backup, integridade e preservação de biometria/Internet.
- [ ] CI nativo completo, inclusive três emuladores.
- [ ] Teste funcional real de exportação e compartilhamento PDF nas APIs 26/28 e 33, verificando que não pede acesso a armazenamento/fotos.
- [ ] Revisão humana de todos os fluxos que acessam imagens de mídia externa.

## Limites

O laboratório não implementa concessões de novas permissões em runtime, alteração de banco, ou publicação. Expo `FileSystemFileProvider` e `SharingFileProvider` devem continuar com `exported=false`. O build é Debug-signed mesmo usando task Gradle `assembleRelease`, com OTA preview sem assinatura; `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem merge para `main` ou distribuição a usuários financeiros.
