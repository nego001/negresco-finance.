# Negresco Finance | SQLCipher Android experimental library

**Scope: disposable synthetic SQLite files ONLY. Not the finance app. No Expo module, signed APK, real-device test, production SQLCipher key, banking data, or financial migration.**

## Verified upstream dependency

- Zetetic SQLCipher for Android **Community Edition**:
  `net.zetetic:sqlcipher-android:4.19.1`.
- AndroidX SQL interfaces: `androidx.sqlite:sqlite:2.7.0`.
- The old `android-database-sqlcipher` artifact is deprecated; do **not** substitute it.
- Official installation: https://www.zetetic.net/sqlcipher/sqlcipher-for-android-community/
- Official migration and explicit native library loading:
  https://www.zetetic.net/sqlcipher/sqlcipher-for-android-migration/
- Source: https://github.com/sqlcipher/sqlcipher-android

**Build does not imply license review, reproducible native builds, integrity/audit validation, Samsung behavior, ABI testing or 16-KiB page compliance.** Dependency license, POM, SBOM, component hashes and shipped .so checks must be independently reviewed before any APK work. The dedicated CI can install Android SDK platform 36 **on its disposable runner**, never on the user's phone.

## Lab module design

`SyntheticSqlCipherDatabase` is intentionally located under
`tooling/sqlcipher-android-lab`, a standalone `com.android.library` Gradle
project. It is never linked from `apps/mobile`. Its file path is fixed to
`noBackupFilesDir/negresco_sqlcipher_synthetic_v1.db`. Its opening API:

- `openExistingSynthetic(...)`: refuses missing, empty, truncated, symbolic-link and known plaintext SQLite files before native open; uses `SQLiteDatabase.OPEN_READWRITE` without `CREATE_IF_NECESSARY`. A random-looking header is not proof of encryption.
- `createFreshSynthetic(...)`: requires an explicit call and exclusive file creation. It refuses an existing file, even corrupted or empty. It does not overwrite or delete existing data.
- Both: expect a disposable random **32-byte synthetic passphrase**, load `sqlcipher` explicitly, use **only** `net.zetetic.database.sqlcipher.SQLiteDatabase`, verify `PRAGMA cipher_version` and perform an actual keyed `sqlite_master` read. The native open additionally checks **`PRAGMA cipher_integrity_check` (zero rows when intact)** and **`PRAGMA integrity_check` (one `ok` row)**. Wrong key, missing native library and invalid DB cause an error, never a fallback to platform SQLite.
- Only an extra passphrase copy is wiped. Native buffers and caller-owned arrays are beyond the helper's guarantee. `byte[]` SQLCipher passphrase input does **not** automatically constitute a raw random page key or secure AndroidKeyStore integration.

The shared portable `SqlCipherLabGuard` carries **12 JVM-only** input and header policy tests. These are not actual SQLCipher database tests: that requires a running Android runtime with native `.so` support.

## Local compilation

From the repository root with JDK 17, Android SDK **36**, AGP **8.10.1** and Gradle **8.11.1**. The SQLCipher 4.19.1 AAR requires compileSdk 36 and its published Kotlin dependencies use 2.2 metadata. This separate lab uses Kotlin **2.2.10**; the other two labs are unchanged:

```bash
gradle -p tooling/sqlcipher-android-lab compileDebugKotlin compileDebugAndroidTestKotlin --no-daemon
```

GitHub Actions has a separate `sqlcipher-android-lab` job that compiles Kotlin against the Zetetic AAR and **fifteen Android instrumentation scenarios**. A separate `sqlcipher-android-emulator` job, restricted to pull requests, attempts to **execute** these tests in a disposable Android API 35 x86_64 emulator after the compile job succeeds. It uses the Android emulator runner pinned to commit `a421e43855164a8197daf9d8d40fe71c6996bb0d`, Gradle 8.11.1 and an ephemeral SDK 36. It never installs the Negresco Finance APK or connects to Samsung. A job being configured or queued does not count as executed; see GitHub Actions logs for actual results. The core suite previously passed **9/9** on the emulated Android runner (PR #6). A subsequent three-test integrity/WAL extension is a separate unapproved revision until re-executed.

## Mandatory next gates

1. **Execute and pass** all fifteen Android tests on the disposable emulator: correct/wrong key, SQLite plaintext, reopen, missing file, duplicate create, truncated file, `cipher_integrity_check`, rolled-back transaction, and scan for a known synthetic marker in main DB/WAL. The added cases cover a deliberate encrypted-page bit flip, committed WAL durability after clean keyed reopen, and an aborted WAL transaction. Sudden process death, power loss, torn writes, hot WAL recovery, broader corruption coverage and multi-device restores are still pending. Absence of a synthetic plaintext marker is useful evidence, not a complete confidentiality proof.
2. Verify the actual native .so binaries and license compliance for supported ABIs, 16-KiB memory pages, app signing and distribution security.
3. Design a dedicated random SQLCipher page key, Keystore-backed wrapping and **CryptoObject** authorization with lifecycle revocation, as distinct from existing AES record/HMAC lab keys. No hardcoded passphrase, plaintext storage or JavaScript proof.
4. Independently review creation/open/migration and backup/recovery. Never silently migrate plaintext or delete user files.
5. Android physical Samsung QA and independent cryptographic review before any real transactions.

Reference `docs/security/SQLCIPHER_ZERO_KNOWLEDGE_GATE.md`, `docs/security/BITWARDEN_GRADE_SECURITY_GATES.md` and ADR 0001.


## Emulator bug diagnosed and corrected

The first actual emulated Android execution reached all nine JNI tests:
**eight passed and one failed**. The failing test incorrectly expected
`cipher_integrity_check` to emit `ok`. Per the [official SQLCipher API](https://www.zetetic.net/sqlcipher/sqlcipher-api/),
**zero rows** means no HMAC/page errors; one row is emitted **for each error**.
The test now requires zero rows. The separate standard SQLite
`integrity_check` must return exactly one `ok`. The native open helper
was strengthened to reject either page-level or logical integrity problems.

This is a test expectation correction plus a stricter native read, **not a
waiver, skipped test or automatic corruption recovery**. The first 8/9
result is not treated as approval: the full Android emulator suite must
pass again on the new commit. No Samsung, Expo or user data is involved.


## Next adversarial suite: page corruption and WAL durability

Three additional isolated instrumentation cases are authored for the disposable
Android emulator:

1. Tamper one encrypted page byte **after a clean database close**, then
   require `openExistingSynthetic()` to fail and leave the damaged file
   untouched for manual investigation. This is synthetic fault injection,
   never tampering with production databases.
2. Commit a WAL transaction, close and keyed-reopen; the marker must remain.
3. Abort a WAL transaction, close and keyed-reopen; the previously committed
   marker must survive while the aborted row remains absent.

**These are not process-kill or power-loss tests**. A clean close plus a
transaction rollback only verifies normal WAL behavior. No reliability claim
for emergency shutdown is authorized until an independent test actually
kills a separate process mid-transaction and validates the outcome.


## Subprocess kill during an open SQLCipher WAL transaction (new test)

A new `SyntheticSqlCipherCrashProvider` is registered only in this isolated
Gradle Android library, with `android:exported="false"` and
`android:process=":sqlcipher_crash_test"`. Its native process verifies its
own process name before doing anything destructive. The host instrumentation
test creates a disposable encrypted WAL fixture and one committed row. The
provider opens it with the synthetic passphrase, inserts a second row inside
an **uncommitted** transaction, syncs a non-secret witness file, then calls
`Process.killProcess(Process.myPid())` **inside that private subprocess**.

The test then confirms the witness, checks that the helper process exited,
keyed-reopens the SQLCipher database and asserts that the earlier committed
row survives while the aborted row does not. There is **no** clean
`endTransaction()` or database `close()` in the doomed process. This is a
controlled process-death simulation, **not** sudden power failure, torn
writes, device storage failure or durability under all Android conditions.

The test is included in emulator CI but must pass there before counting it
as validated. In no circumstances link this crash provider, test code or
synthetic passphrase to `apps/mobile`, a production APK or any real finance
records. Test files stay inside the disposable app's `noBackupFilesDir`.


## Emulator validation after IPC race fix (2026-10-19/20 UTC)

Run [39347703529](https://github.com/nego001/negresco-finance./actions/runs/39347703529),
job `sqlcipher-android-emulator`: **13/13 native Android tests passed**;
log shows `Starting 13 tests`, `Finished 13 tests`, `BUILD SUCCESSFUL`.
The first synchronous provider-kill attempt was inconsistent across CI runs:
Android sometimes terminated the instrumentation process while the Binder
call was active. The provider now **returns its private IPC call first**,
starts the uncommitted transaction in a private worker and kills only that
private process after the client's Binder reference has been released.

This is one successful validated revision, NOT statistical evidence of
flakiness elimination and NOT a device power-loss simulation. A future job
should run the subprocess-death case repeatedly and test recovery after
storage/process restart without relying on fixed sleep durations.

## Synthetic AndroidKeyStore-wrapped SQLCipher secret (separate lab)

`SyntheticSqlCipherKeyWrap.kt` creates a **separate non-biometric** AES-256-GCM
Keystore key by explicit lab-only provisioning. It wraps a disposable 32-byte
SQLCipher test passphrase into a fixed-size authenticated envelope with domain
AAD and a random provider-selected nonce. Unwrap **never provisions** the key,
and an absent key, bad length, bad version or changed authentication tag
fails closed. The envelope is returned only in memory: this laboratory does
not store or back it up.

Two additional Android instrumentation tests exercise wrapped-key SQLCipher
open/reopen and corrupted-envelope rejection, taking the suite from
**13 to 15**. The earlier **13/13** run was approved on the emulator; the
new 15-test suite requires its own successful GitHub Actions execution.

**No production security claim**: the synthetic Keystore key has
`setUserAuthenticationRequired(false)` behavior by omission. The class does
not implement BiometricPrompt.CryptoObject, StrongBox attestation, KeyStore
key invalidation, recovery, rotation or secure persistent envelope storage.
It is not wired to the installed APK or user records. These are mandatory
before any real finance data can be entrusted to the architecture.


## Laboratório seguinte: autorização por CryptoObject

**Código criado na branch do PR #6, ainda NÃO homologado:**
- `BiometricCipherAuthorizationLab.kt`: chave AES-256-GCM de laboratório com criação explícita, autenticação `BIOMETRIC_STRONG` por operação (API 30+) e invalidação quando biometria cadastrada muda. Exige que o objeto `Cipher` retornado pelo `BiometricPrompt.CryptoObject` seja exatamente a instância original e que a `Activity` permaneça em `RESUMED`. Cancelamento ou `onStop` rejeitam o uso; nenhuma aprovação de UI isolada serve como autorização criptográfica.
- `BiometricSqlCipherKeyEnvelopeLab.kt`: envelopamento DESACOPLADO da classe anterior, somente em memória e com senha **fictícia** de 32 bytes, versão/magic, IV de 12 bytes escolhido pelo provedor, AES-GCM autenticado (tag de 128 bits) e AAD de domínio. Recuperação nunca provisiona chave, não usa SQLite plaintext como fallback e apaga cópias temporárias nos caminhos controlados.
- `BiometricEnvelopeNegativeInstrumentedTest.kt`: dois casos adicionais verificam recusa de comprimento/versão inválidos ANTES de pedir biometria e confirmam que checagens de formato não criam nem apagam alias Keystore.

A suíte de Android instrumentado cresce de **15 para 17 cenários**, aguardando CI na nova revisão. Testes de formato não validam o conteúdo autenticado do GCM. **Ainda NÃO existem testes positivos reais de sensor/prompt**, cancelamento físico, mudança de biometria, retorno ao background e recuperação de chave numa segunda instalação/dispositivo. A integração com Expo, banco financeiro persistente, recuperação e assinatura Android também continuam pendentes. Não tratar compilação como aprovação de segurança bancária.

O teste de 15/15 do PR #6 anterior passou no run [39355448172](https://github.com/nego001/negresco-finance./actions/runs/39355448172). A nova revisão requer confirmação independente no GitHub Actions; não reutilizar a conclusão daquele commit como se cobrisse o código novo.


## Enrijecimento de autorização de uso único do CryptoObject

Após confirmar **17/17 testes Android** no emulador do commit `38c0239` (GitHub Actions [39363287809](https://github.com/nego001/negresco-finance./actions/runs/39363287809)), foi criada uma camada de decisão determinística `BiometricOperationGate` para reforçar a autorização por `BiometricPrompt.CryptoObject`.

Regras: um `Cipher` só é aceito se for a **mesma instância** usada na operação, após callback bem-sucedido com `Activity` em `RESUMED`; cancelamento, `onStop`, mudança de estado e objeto incompatível recusam acesso. Após uma chamada de `consume`, a autorização não pode ser reutilizada. `BiometricCipherAuthorizationLab` passou a consumir essa decisão além da autorização obrigatória de hardware via AndroidKeyStore.

`BiometricOperationGateInstrumentedTest.kt` adiciona **oito cenários** isolados: ausência de callback, uso único, objeto trocado, objeto ausente, callback após background, perda de primeiro plano após aprovação, cancelamento antes de callback tardio e callback duplicado. Com isso, a suíte projetada passa de 17 para **25 cenários**. **Esta revisão necessita sua própria compilação e execução de emulador em CI antes de contar como aprovada.** Os oito novos testes usam Ciphers descartáveis sem sensor; comprovam somente a política local de callbacks, não autenticação humana, material criptográfico hardware-backed nem execução de AES-GCM autenticada.

**Permanecem pendentes**: provisionamento/inscrição biométrica em emulador de teste apropriado, aceitação via prompt real, cancelamento/erro nativos, invalidação da chave após nova impressão digital, suspensão/retorno da Activity durante o prompt e testes físicos no Samsung A55, além de recuperação/migração, StrongBox quando compatível, auditoria e integração Expo/SQLCipher de produção.

Estado da etapa: **laboratório somente com dados sintéticos, sem alterar o APK ou a main**.


## Gate Android real: ciclo de vida e prova de autenticação (20/10/2026)

**Resultado anterior confirmado:** a suíte de 25 testes Android instrumentados foi aprovada no run [39364403723](https://github.com/nego001/negresco-finance./actions/runs/39364403723) para a revisão `ff9be58`.

Nova evolução **somente no laboratório separado**, não no aplicativo:
- `SyntheticBiometricTestActivity` é uma `FragmentActivity` não exportada registrada apenas no manifesto do projeto de laboratório, acompanhada da permissão Android `USE_BIOMETRIC`.
- `BiometricPlatformPreflightInstrumentedTest` acrescenta **dois testes**: rejeição por uma Activity que já passou a `CREATED` (fora de primeiro plano) e recusa de provisionar chave quando `BIOMETRIC_STRONG` não está cadastrado. Esse segundo teste usa `Assume` e é **ignorado se o dispositivo já tiver biometria forte cadastrada**, pois só faz sentido em um aparelho sem biometria.
- `BiometricManualRealPromptInstrumentedTest` acrescenta **um cenário separado e explicitamente opcional**: usar `BiometricPrompt.CryptoObject` real duas vezes (cifrar e depois recuperar uma senha descartável de 32 bytes), comparando os bytes. O usuário/testador precisa aprovar duas autenticações reais, e há limite de 120 segundos. Nunca usa dados financeiros nem apaga/recria automaticamente um alias já existente. Requer Android API 30+ com biometria forte.
- Esta configuração é **desligada por padrão** por meio do argumento `negrescoBiometricManual=false`. Na execução automática, esse cenário será contabilizado como **ignorado/skip**, NÃO como prova de teste biométrico aprovado. A suíte passa a ter **28 testes detectáveis: 27 automáticos (um condicional ao estado biométrico) e um opt-in manual**.

### Execução manual autorizada, apenas em dispositivo/emulador de teste

Com JDK 17, SDK 36, Gradle 8.11.1 e `BIOMETRIC_STRONG` já cadastrado, usar o laboratório independente:

```bash
gradle -p tooling/sqlcipher-android-lab connectedDebugAndroidTest -PnegrescoBiometricManual=true --no-daemon
```

O prompt precisa permanecer em primeiro plano para duas leituras autênticas. Em emulador com biometria previamente cadastrada pode ser usado `adb emu finger touch 1` **somente enquanto o prompt estiver aguardando**; esse comando não cadastra uma digital por si só. Testar matrícula/cancelamento/invalidação em cenários separados e nunca presumir que todo emulador, firmware ou leitor biométrico reproduza um aparelho real.

**Observação de execução:** o comando acima habilita o teste opt-in e também pode executar outros testes do laboratório. Apenas usá-lo num ambiente descartável e nunca no Android pessoal sem revisão e autorização. O roteiro de teste físico no A55 e a recuperação segura ainda precisam de aprovação explícita antes de instalar qualquer laboratório no dispositivo do titular.

### Aprovação ainda necessária

- [ ] CI no novo commit: confirmar compilação e cenários Android automáticos; registrar contagens de sucesso/skip corretamente.
- [ ] Biometria real aprovada duas vezes num emulador configurado ou aparelho descartável, com resultado comprovado.
- [ ] Cancelamento e suspensão do **BiometricPrompt real** durante a operação, não apenas teste determinístico de callback.
- [ ] Invalidação após nova digital cadastrada, troca do PIN e reinstalação, sem perda automática de dados.
- [ ] Revisão de segurança da recuperação/migração, testes físicos autorizados no Samsung A55 e auditoria independente.

**O módulo de teste não está vinculado ao Expo nem aos dados financeiros de produção.**
