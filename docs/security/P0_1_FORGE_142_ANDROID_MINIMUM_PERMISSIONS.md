# P0-1 | Forge 1.4.2 no Android com permissões mínimas (laboratório)

Este experimento empilhado sobre PR #97 **não altera** a `main`, releases ou chaves. Só é acionado em push na branch `lab/p01-forge-142-android-minimum-permissions-v1`.

## Hipótese técnica

Combinar `node-forge@1.4.2` com a lista de `expo.android.blockedPermissions` que remove `SYSTEM_ALERT_WINDOW` e `WRITE_EXTERNAL_STORAGE`, sem perder o conjunto de proteções do APK 1.4.1 (rede HTTPS/sistema, backup/transferências proibidos, runtime OTA preview fixado, Hermes e certificado Debug).

## Validação obrigatória

1. Gerar manifesto e lock **somente temporários** com `postcss@8.5.23`, `image-size@2.0.3` e `node-forge@1.4.2`; versão nunca gravada no manifesto versionado de produção. O pin impede deriva transitiva inesperada no runner.
2. `npm audit` sem supressões e `npm ci`, verificar integridade SHA-512 do tarball contra o lock; comparar `lib/rsa.js` e `lib/pem.js` instalados com commit oficial `7928054627d93ab8c0216b756246e8ca8d62a93e` e conferir proteção RSA DER + fix de compatibilidade PEM/Buffer.
3. Testar `pem.decode(Buffer)` com PEM sintético, TypeScript, `expo prebuild`, Gradle `assembleRelease` **assinado somente com Android Debug**.
4. Auditar `AndroidManifest.xml` e recursos compilados dentro do APK: duas permissões bloqueadas, `INTERNET`/`USE_BIOMETRIC` mantidas, cleartext proibido, apenas CA do sistema, backup/transferência proibidos, OTA `preview` unsigned pinado e runtime 3.1.3.
5. Gerar inventário determinístico do APK/Hermes/lock/prova upstream, rebaixar para um artifact temporário de dois dias. **Segundo runner** reinstala o mesmo lock, baixa pacote e fontes oficiais novamente, testa PEM/Buffer, revalida assinaturas Debug e bytes exatos do APK, políticas de rede, backup e permissões.
6. Executar CI geral e testes Node para impedir remoção das verificações, mas **não** considerar esse CI um teste funcional de PDFs em dispositivos reais.

## Limites que não podem ser promovidos por resultados verdes

- `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem merge automático, APK em Release ou atualização EAS OTA.
- OTA remoto **preview sem assinatura** continua deliberadamente habilitado para laboratório: instalar como aplicativo financeiro real é proibido.
- `expo-print` e `expo-sharing` ainda requerem regressão real/por API nos Android antigos após a remoção de `WRITE_EXTERNAL_STORAGE`.
- Procedência de pacote e testes sintéticos não substituem revisão humana, testes com entradas criptográficas adversariais, auditoria de permissões runtime, fluxos bancários e assinatura de release.
- Tag Git v1.4.2 anotada sem assinatura Git verificada na consulta anterior; comparação de arquivos oficiais não resolve sozinha confiança completa na cadeia de suprimentos.
