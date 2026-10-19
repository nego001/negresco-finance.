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
- Both: expect a disposable random **32-byte synthetic passphrase**, load `sqlcipher` explicitly, use **only** `net.zetetic.database.sqlcipher.SQLiteDatabase`, verify `PRAGMA cipher_version` and perform an actual keyed `sqlite_master` read. Wrong key, missing native library and invalid DB cause an error, never a fallback to platform SQLite.
- Only an extra passphrase copy is wiped. Native buffers and caller-owned arrays are beyond the helper's guarantee. `byte[]` SQLCipher passphrase input does **not** automatically constitute a raw random page key or secure AndroidKeyStore integration.

The shared portable `SqlCipherLabGuard` carries **12 JVM-only** input and header policy tests. These are not actual SQLCipher database tests: that requires a running Android runtime with native `.so` support.

## Local compilation

From the repository root with JDK 17, Android SDK **36**, AGP **8.10.1** and Gradle **8.11.1**. The SQLCipher 4.19.1 AAR requires compileSdk 36 and its published Kotlin dependencies use 2.2 metadata. This separate lab uses Kotlin **2.2.10**; the other two labs are unchanged:

```bash
gradle -p tooling/sqlcipher-android-lab compileDebugKotlin compileDebugAndroidTestKotlin --no-daemon
```

GitHub Actions has a separate `sqlcipher-android-lab` job for this compile. This step compiles Kotlin code against the Zetetic AAR and **six Android instrumentation scenarios**, but does **not execute** Android/JNI code, install APKs, open an actual SQLCipher database, test WAL recovery or authorize a finance release. The scenarios, under `src/androidTest`, require a dedicated emulator/test APK, explicitly isolated fixture data and a separate QA run.

## Mandatory next gates

1. **Run** the six compiled Android instrumentation scenarios on a dedicated test emulator: correct/wrong key, SQLite plaintext, reopen, missing file, duplicate create and truncated file. Additional process-death, WAL, corruption and transaction interruption scenarios are still missing.
2. Verify the actual native .so binaries and license compliance for supported ABIs, 16-KiB memory pages, app signing and distribution security.
3. Design a dedicated random SQLCipher page key, Keystore-backed wrapping and **CryptoObject** authorization with lifecycle revocation, as distinct from existing AES record/HMAC lab keys. No hardcoded passphrase, plaintext storage or JavaScript proof.
4. Independently review creation/open/migration and backup/recovery. Never silently migrate plaintext or delete user files.
5. Android physical Samsung QA and independent cryptographic review before any real transactions.

Reference `docs/security/SQLCIPHER_ZERO_KNOWLEDGE_GATE.md`, `docs/security/BITWARDEN_GRADE_SECURITY_GATES.md` and ADR 0001.
