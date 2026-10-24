# P0-1 | Identidade do APK no pacote de testes

**Escopo:** auditoria de integridade entre os arquivos de candidato Android,
somente após `assembleRelease` e a inspeção da assinatura e do pacote APK.
Nenhuma instalação, assinatura nova ou publicação é realizada pelo auditor.

O job `build-test-apk` chama
`tooling/android/verify_release_bundle_consistency.py` **antes** de enviar
artefatos GitHub Actions. A verificação exige que:

- `android/app/build/outputs/apk/release/app-release.apk` e
  `Negresco-Finance-V3.1.3-preview.apk` possuam SHA256 idêntico;
- o APK dentro de `Negresco-Finance-V3.1.3-preview.zip` tenha o **mesmo**
  digest, mesmo que o hash do próprio ZIP esteja atualizado;
- `APK-SIGNATURE.txt` seja idêntico dentro e fora do ZIP;
- `SHA256-original-apk.txt` dentro do ZIP e `android-apk.sha256` fora
  referenciem o APK montado no caminho esperado;
- `SHA256-release.txt` contenha exatamente os três nomes esperados,
  hashes corretos e sem duplicações;
- o ZIP contenha apenas os quatro arquivos previstos, sem caminhos
  adicionais, duplicações ou entrada vazia.

Os testes Node geram bytes e ZIPs **sintéticos** para forçar divergências.
O gate compara artefatos de **uma única execução** e não demonstra
reprodutibilidade entre builds, autenticidade do publisher, proteção contra
comprometimento do runner nem segurança da assinatura. Para isso continuam
necessários a verificação `apksigner`, identidade de certificado fixada em
assinatura estável e revisão independente.

A build de branch segue com token `contents:read`, e o único job de
publicação requer opt-in manual em `main`. Não publicar nem instalar o
candidato até cumprir os gates físicos/financeiros externos.
