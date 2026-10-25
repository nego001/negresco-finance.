# P0-1 | Rastreabilidade APK ↔ dependências npm

PR DRAFT empilhada sobre #75. Não modifica `main`, não
promove pacote npm e não publica release.

## Lacuna observada

A #75 já compilou o APK completo com `postcss@8.5.23` e
`image-size@2.0.3` e o job independente confirmou seu SHA-256
e as configurações OTA do binário. Entretanto, o artefato
baixado apresentava o relatório de viabilidade e o checksum
do APK sem conter o **lockfile utilizado pelo `npm ci`**.

Sem o lockfile no mesmo conjunto de evidências, a relação
entre os bytes do APK, o grafo npm candidato e o commit de
origem não podia ser reavaliada diretamente pelo segundo job.

## Proteção nova

O verificador `tooling/android/verify_combined_apk_provenance.cjs`
possui dois modos:

- `capture`: após compilar e auditar o APK, produz
  `COMBINED_APK_PROVENANCE.json` com SHA-256 e tamanho do APK,
  SHA-256 do lockfile, SHA-256 do relatório comparativo e
  SHA do commit GitHub. Exige exatamente PostCSS 8.5.23,
  image-size 2.0.3, ausência de queue, diff do lockfile e
  cinco advisories HIGH. Marca `reviewerApproved:false`.
- `verify`: depois de baixar o mesmo artifact GitHub Actions,
  reabre **APK, lockfile, relatório e proveniência**, recalcula
  os hashes, verifica o commit original e recusa divergências.
  Continua sendo um job separado, `contents:read`, sem execução
  dos scripts do artifact baixado.

O workflow de laboratório agora inclui o lockfile
`image-size-candidate-lock.json` no artifact APK temporário,
junto com o JSON de proveniência. Não altera dependências de
produção nem a política de OTA `preview`.

`tests/android-combined-apk-dependency-provenance.test.mjs`
cobre adulteração do APK, lockfile, SHA Git, advisories,
status de aprovação, symlinks e artefatos ausentes.

## Limitações

O JSON é uma **declaração do runner, não um atestado
criptograficamente assinado por uma autoridade independente**.
Conferir hashes e commit melhora rastreabilidade, mas não
demonstra por si só que código malicioso não foi injetado
em uma dependência ou no processo de compilação. Não
equivale a SLSA provenance assinada, SBOM completa,
build bit a bit reproduzível ou assinatura OTA segura.

Restam **cinco vulnerabilidades HIGH** transitivamente
associadas a `node-forge` e à cadeia de certificados do
Expo. A publicação estável continua bloqueada pelos
gates anteriores e requer revisão humana.
