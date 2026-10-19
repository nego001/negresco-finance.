# Native lock experiment: JVM policy only

**Status: experimental Kotlin policy and real Jetpack DataStore transactions tested in an isolated JVM project. NOT connected to Android,
Expo, the existing APK, SQLite/SQLCipher or real biometric hardware.**

This code establishes fail-closed rules that a future Kotlin + Jetpack DataStore
adapter must obey. It intentionally has no implementation of `AtomicLockStore`
on Android and no implementation of `NativeBiometricVerifier` using BiometricPrompt.
The in-memory store and synthetic verifier exist **only in tests**. Do not wire
the test verifier into a shipped app.

## What is implemented

- Versioned record and monotonically incrementing revision, refusing unknown
  versions, negative revisions and stale or exhausted revisions.
- No implicit unlock for missing, corrupted or unreadable records.
- Revocation of an unlocked session on background or manual lock; returning
  to foreground does not re-open it.
- Rejection of delayed biometric completions after a session generation change.
- Refusal of concurrent/reentrant biometric prompts.
- A typed atomic-update store contract for later integration with DataStore.
- 10 offline JVM scenarios in `NativeLockCoordinatorTest.kt`.
- A separate `DataStoreLockRecordRepository` uses the real AndroidX DataStore API (`datastore-preferences-core:1.2.1`) for atomic compare-and-set of version, enabled and revision in one transactional snapshot.
- 7 persistent DataStore JVM scenarios including reopen, racing writers and corruption. No Android adapter or biometric authorization is attached to that repository.

## Run JVM smoke tests

With JDK 17 and Gradle 8.10.2, from the repository root:

```bash
gradle -p tooling/native-lock-spike policyCheck --no-daemon
```

For local environments already providing `kotlinc`, equivalent compilation:

```bash
cd tooling/native-lock-spike
kotlinc src/main/kotlin/com/negresco/finance/security/NativeLockCoordinator.kt \
  src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt \
  -include-runtime -d /tmp/negresco-native-lock-check.jar
java -jar /tmp/negresco-native-lock-check.jar
```

The CI job `native-lock-spike` compiles the Kotlin project and executes the
10 policy scenarios plus 7 DataStore persistence scenarios. Passing this job is **not** an Android APK compile or device QA. DataStore returns after durable write, but using it alone does not prove that a biometric request remains valid until commit.

## Non-negotiable gates before Expo integration

1. Implement native-only authentication with Android BiometricPrompt and
   real cancellation semantics. No `authenticated=true` input from JS.
2. Instantiate a singleton DataStore on Android and bridge the tested repository's suspending calls; bridge
   coroutine/suspend semantics without holding Java monitors over suspension.
3. Make Activity backgrounding and the commit order linearizable; handle
   process death, corruption and denied access.
4. Design a safe one-time migration from legacy `AsyncStorage` without
   discarding existing app data or silently disabling protection.
5. Test on a Samsung with synthetic data and a properly signed APK, including
   fingerprint enrollment changes and interrupted updates.
6. Add Expo local module only after integration gates are met. Adding it
   changes the native APK and cannot safely ship through OTA alone.

See `docs/security/NATIVE_LOCK_PERSISTENCE_V1.md` for the architecture.
