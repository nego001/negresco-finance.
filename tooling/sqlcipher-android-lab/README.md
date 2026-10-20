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

GitHub Actions has a separate `sqlcipher-android-lab` job that compiles Kotlin against the Zetetic AAR and **thirteen Android instrumentation scenarios**. A separate `sqlcipher-android-emulator` job, restricted to pull requests, attempts to **execute** these tests in a disposable Android API 35 x86_64 emulator after the compile job succeeds. It uses the Android emulator runner pinned to commit `a421e43855164a8197daf9d8d40fe71c6996bb0d`, Gradle 8.11.1 and an ephemeral SDK 36. It never installs the Negresco Finance APK or connects to Samsung. A job being configured or queued does not count as executed; see GitHub Actions logs for actual results. The core suite previously passed **9/9** on the emulated Android runner (PR #6). A subsequent three-test integrity/WAL extension is a separate unapproved revision until re-executed.

## Mandatory next gates

1. **Execute and pass** all thirteen Android tests on the disposable emulator: correct/wrong key, SQLite plaintext, reopen, missing file, duplicate create, truncated file, `cipher_integrity_check`, rolled-back transaction, and scan for a known synthetic marker in main DB/WAL. The added cases cover a deliberate encrypted-page bit flip, committed WAL durability after clean keyed reopen, and an aborted WAL transaction. Sudden process death, power loss, torn writes, hot WAL recovery, broader corruption coverage and multi-device restores are still pending. Absence of a synthetic plaintext marker is useful evidence, not a complete confidentiality proof.
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
