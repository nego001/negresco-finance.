# P0-1 | Android: negar backups e transferências de dados financeiros

Este laboratório adiciona uma política de exclusão de dados ao
projeto Expo Android do Negresco Finance. Não instala nem publica APK
e mantém a branch `main` intacta.

## Motivo

O projeto já utiliza `android.allowBackup=false`. A documentação oficial
do Android avisa, porém, que em Android 12 ou posterior alguns fabricantes
podem manter o caminho de **transferência direta entre dispositivos (D2D)**
mesmo com essa flag desativada.

O Android permite definir regras distintas para backups na nuvem e para
transferências D2D por meio do atributo
`android:dataExtractionRules` no manifesto e de um XML em
`res/xml`. Android 11 e anteriores continuam a exigir outro formato
(`android:fullBackupContent`).

## Alteração no Expo prebuild

Adiciona o plugin local
`apps/mobile/plugins/withNegrescoNoDataExtraction.js` ao
`apps/mobile/app.json`:

- `android:allowBackup=false`, explicitamente;
- `android:dataExtractionRules=@xml/negresco_no_data_extraction`;
- `android:fullBackupContent=@xml/negresco_legacy_no_backup`.

O plugin gera dois XMLs com exclusões `path="."` nas nove categorias
de armazenamento documentadas: `root`, `file`, `database`,
`sharedpref`, `external`, `device_root`, `device_file`,
`device_database` e `device_sharedpref`.

Para Android 12+, ambos os blocos `cloud-backup` e
`device-transfer` contêm as nove exclusões, sem `include`.
O cloud backup ainda define
`disableIfNoEncryptionCapabilities=true`. Para dispositivos
antigos, o `full-backup-content` repete as nove exclusões.

Se um arquivo de política já existir com bytes diferentes
ou for um symlink, o plugin **falha sem sobrescrevê-lo**.

## Evidência na CI

O workflow de compilação valida o manifesto Android resultante do Expo
prebuild e os dois arquivos XML contra o conteúdo fixo do plugin.
Depois de compilar o APK, o `aapt dump xmltree` inspeciona o
`AndroidManifest.xml` binário. O publicador exige referências de
recursos Android válidas e únicas para `dataExtractionRules` e
`fullBackupContent`. O caminho interno `res/xml/...` não é assumido,
pois o empacotamento pode remapeá-lo. Os dois XMLs de origem já são
comparados integralmente no passo posterior ao Expo prebuild.

A suíte Node exercita o plugin usando funções de modificação Expo
simuladas, validando os dois modos de transferência, configuração
repetida, referências nativas, corrupção dos XML e symlinks.

## Limites e auditorias futuras

Esta alteração estabelece regras declarativas de exclusão em um projeto
Android gerado pelo Expo. Ela **não prova experimentalmente** que um OEM
ou mecanismo proprietário vá respeitar a política, e não protege contra
exportações de dados feitas deliberadamente pelo próprio aplicativo.
Testes de restauração/cloud e D2D em aparelhos reais seguem necessários.

A inspeção atual do APK confirma referências válidas aos recursos no
manifesto compilado, mas não prova o conteúdo das tags XML já binárias;
uma auditoria independente desse conteúdo e testes em aparelho físico
continuam necessários antes de distribuição.

Referências Android:
https://developer.android.com/identity/data/autobackup
https://developer.android.com/about/versions/12/behavior-changes-12

Gates: 9/9 jobs CI Android no SHA final, APK do mesmo código,
publicação SKIPPED, revisão técnica e autorização antes de mesclar.
