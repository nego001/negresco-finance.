# P0-1 | Vincular a politica OTA ao AndroidManifest gerado

PR em rascunho, empilhada sobre #57. Esta etapa NAO modifica main,
nao publica APK/release, nao solicita chaves privadas e nao instala OTA.

## Lacuna de seguranca

A PR #57 exige configuracao de assinatura de Expo Updates ou
\`updates.enabled=false\` **no app.json**, antes de uma release estavel.
Essa fonte nao e prova suficiente de que o \`expo prebuild\` realmente
inseriu os mesmos valores em AndroidManifest.xml.

## Contramedida

\`tooling/android/verify_generated_ota_manifest.py\` usa somente Python
stdlib para ler o **manifesto nativo gerado** apos Expo prebuild.
O script rejeita arquivos grandes, symlinks de certificado, DOCTYPE
e ENTITY, XML malformado, duplicacoes e metadados inesperados.

- Em \`embedded-only\`, exige \`expo.modules.updates.ENABLED=false\`
  no elemento \`application\` e nenhuma configuracao de assinatura OTA.
- Em OTA assinada, exige \`expo.modules.updates.ENABLED=true\`,
  \`CODE_SIGNING_CERTIFICATE\` identico byte a byte ao PEM declarado
  (apos decodificacao das entidades XML), e
  \`CODE_SIGNING_METADATA\` JSON igual a algoritmo/keyid configurados.
- Metadados em \`activity\` ou outros componentes nao contam como
  configuracao de \`application\`.
- A verificacao so executa para despacho manual da \`main\` com
  \`stable_signing\` ou \`publish_release\`, imediatamente apos o gate
  da PR #57, antes do Gradle e antes de qualquer publicacao.

O verificador nao testa a cadeia do X.509: essa responsabilidade
continua com o verificador criptografico da PR #57, executado antes.
Chaves privadas nunca entram neste processo.

## Evidencias / limites

Testes adversariais executam o Python real para manifests sinteticos
validos, desabilitados, adulterados, duplicados, substituidos e
malformados. O workflow Android inclui os dois arquivos de mudanca
nos gatilhos de build.

**Isto verifica o XML gerado pelo Expo, nao os bytes compilados do APK.**
Ainda e necessario provar os valores via AAPT2 no APK de distribuicao
final, executar uma atualizacao OTA assinada end-to-end em dispositivo,
e auditar custodia/rotacao de chaves.

No estado atual o app usa OTA \`preview\` sem assinatura, portanto
continua **bloqueado para distribuicao estavel** pela PR #57.
O APK de laboratorio continua debug e nao e publicacao autorizada.
Gates obrigatorios: testes Node, Android CI 9/9, build APK real,
publicador SKIPPED e revisao humana antes de merge/release.
