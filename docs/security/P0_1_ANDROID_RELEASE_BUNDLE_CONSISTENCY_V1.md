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


## Limites de segurança para extração ZIP

O auditor também rejeita entradas ZIP marcadas como **links simbólicos ou
arquivos especiais**, criptografia ZIP ou métodos de compressão diferentes de
`STORED` e `DEFLATED`. Além do limite global do APK (1 GiB), cada
relatório ou texto auxiliar tem limite próprio (assinatura até 1 MiB,
SHA original até 512 bytes, `LEIA-ME.txt` até 1 MiB). A razão entre
tamanho descomprimido e comprimido é limitada a 200:1 por membro.
Essas verificações ocorrem antes de ler o conteúdo comprimido.

Os novos testes fabricam um ZIP com `LEIA-ME.txt` marcado como symlink,
outro com método LZMA e outro com texto exageradamente compactável,
**recalculando o hash externo** para comprovar que ele não é uma
justificativa para confiar em qualquer ZIP. O empacotamento normal
`zip -9` permanece permitido. Esse é um controle de candidato
de distribuição, não um substituto de sandbox na extração do usuário.
