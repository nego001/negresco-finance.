# P0-1 | Prova das exclusões de backup no APK compilado

Etapa de laboratório empilhada sobre a PR #54, sem publicação,
alteração de contas financeiras, credenciais ou integração na `main`.

## Lacuna

Os plugins Expo já geram e conferem integralmente os XMLs
`dataExtractionRules` (Android 12+) e `fullBackupContent`
(legado). O APK compilado também já exige referências de recursos
válidas e distintas em `AndroidManifest.xml`.

Mas conferir **apenas as referências** não prova que o recurso
compilado ainda exclui todos os domínios relevantes. Uma alteração
durante o build poderia deixar a transferência entre aparelhos
ou um caminho de backup parcialmente autorizados.

## Auditoria acrescentada

O arquivo `tooling/android/verify_compiled_backup_policy.py`
opera sobre o APK final e exige:

1. Exatamente um `application` e referências únicas para
   `dataExtractionRules` e `fullBackupContent`, com IDs distintos.
2. Resolução do ID até `resources.arsc`, validando os nomes dos
   recursos sem supor um caminho fixo em `res/xml`.
3. Arquivos compilados existentes e únicos no APK, com limites
   de tamanho e rejeição a links e arquivos especiais.
4. Para `data-extraction-rules`, somente as seções
   `cloud-backup` e `device-transfer`, nessa ordem,
   sem elementos `include` ou atributos desconhecidos.
5. `disableIfNoEncryptionCapabilities=true` na seção de nuvem.
6. **Nove exclusões completas e sem repetição** em cada seção:
   `root`, `file`, `database`, `sharedpref`, `external`,
   `device_root`, `device_file`, `device_database`,
   `device_sharedpref`. Cada uma exige o caminho `.`.
7. No `full-backup-content` legado, as mesmas nove exclusões,
   sem exceções de inclusão.

Toda divergência interrompe o build **antes de carregar os
artefatos** para o workflow de publicação. As validações de rede,
assinatura e identidade existentes seguem ativas.

Os testes `tests/android-compiled-backup-policy.test.mjs` executam
o verificador real com `aapt2` simulado e APKs ZIP sintéticos,
cobrindo recursos ausentes, referências duplicadas, domínios
faltantes, caminhos parciais, exceções de inclusão e regras
de criptografia alteradas.

## Limites

A auditoria prova a política *declarativa compilada* e não garante,
por si só, o comportamento de um aparelho real. Particularmente,
transferências de dados podem apresentar diferenças entre versões
Android e fabricantes. Os testes em aparelhos físicos e a revisão
de segurança continuam necessários para qualquer lançamento.

A compilação nativa no GitHub Actions deve confirmar que o
verificador interpreta corretamente a saída da versão de
`aapt2` usada pelo projeto. Um teste simulado verde não substitui
um APK aprovado.

Referências:
- https://developer.android.com/identity/data/autobackup
- https://developer.android.com/tools/aapt2

Gates: suíte Node, CI Android, APK do código final, job
de publicação SKIPPED e revisão humana independente.
