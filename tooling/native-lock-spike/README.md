# Native lock experiment: JVM policy only

**Status: experimental Kotlin policy and real Jetpack DataStore transactions tested in an isolated JVM project. NOT connected to Android,
Expo, the existing APK, SQLite/SQLCipher or real biometric hardware.**

This code establishes fail-closed rules that a future Kotlin + Jetpack DataStore
coordinator must obey. The separate Android lab has preliminary adapters but no authenticated commit flow. It intentionally has no implementation of `AtomicLockStore`
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
- 16 offline JVM scenarios in `NativeLockCoordinatorTest.kt`; the older synchronous coordinator now refuses DISABLE before any prompt and revokes old grants on storage failure.
- A separate `DataStoreLockRecordRepository` uses the real AndroidX DataStore API (`datastore-preferences-core:1.2.1`) for atomic compare-and-set of version, enabled and revision in one transactional snapshot.
- 23 persistent DataStore, opt-out preparation/recovery and legacy-migration JVM scenarios, including restart, races, corrupt records, one-time locked migration and refusal to migrate legacy off/null silently.
- 33 coroutine coordinator scenarios, including revocation on externally changed revisions, missing/corrupt DataStore records, background events, cancellation and overlapping prompts. The Android adapters exist only in the separate, non-Expo lab.

## Run JVM smoke tests

With JDK 17 and Gradle 8.10.2, from the repository root:

```bash
gradle -p tooling/native-lock-spike policyCheck --no-daemon
```

The CI job `native-lock-spike` compiles the Kotlin project and executes the
16 policy scenarios plus 23 DataStore/migration scenarios plus 33 coroutine coordinator scenarios, plus 3 deterministic interrupted-write scenarios. Passing this job is **not** an Android APK compile or device QA. DataStore returns after durable write, but using it alone does not prove that a biometric request remains valid until commit.

## Non-negotiable gates before Expo integration

1. Connect the Android-only strong BiometricPrompt adapter from `../native-lock-android-lab` to a native coordinator and verify actual cancellation. No `authenticated=true` input from JS.
2. Connect the Android-only singleton DataStore provider from that lab to a native coordinator. Preserve suspend semantics and avoid holding Java monitors across suspension.
3. Make Activity backgrounding and the commit order linearizable; handle
   process death, corruption and denied access.
4. Design a safe one-time migration from legacy `AsyncStorage` without
   discarding existing app data or silently disabling protection.
5. Test on a Samsung with synthetic data and a properly signed APK, including
   fingerprint enrollment changes and interrupted updates.
6. Add Expo local module only after integration gates are met. Adding it
   changes the native APK and cannot safely ship through OTA alone.

See `docs/security/NATIVE_LOCK_PERSISTENCE_V1.md` for the architecture.


## Prepared opt-out is not actual opt-out

`prepareDisableForLab()` authenticates using the injected native-only prompt
contract and stores `enabled=true, disablePending=true` in one durable
DataStore update. Its result is `PREPARED`, **never** disabled.
`recoverPreparedDisable()` can be called after a process restart, clears
`disablePending` and keeps `enabled=true`. While pending, normal preference
writes and UI unlocking are refused.

The lab's actual `disable()` still returns `DENIED`. This phase is not
exposed by the Android Activity adapter, is not included in any APK, and
is not authorization for financial-data access. The final opt-out commit
requires a separate lifecycle-linearization and cryptographic review.


## Legacy bypass closed and interrupt matrix

The older synchronous `NativeLockCoordinator` used to accept DISABLE in its
synthetic store, despite the Android coroutine coordinator returning DENIED.
Both policy coordinators now deny final opt-out. The synchronous path also
binds unlocked sessions to record revisions and revokes on failed storage.

`OptOutInterleavingTest.kt` models interrupted DataStore updates on both
sides of persistence, plus cancellation after a pending write. All three
scenarios preserve `enabled=true` and allow safe rearming. An Activity
that expires mid-write no longer receives a misleading `PREPARED` result.

These synthetic JVM scenarios do not prove linearizable Android `onStop` or
make a safe `enabled=false` commit possible. Final opt-out stays blocked.


## Local revision rollback detection (JVM + Android lab only)

Once an Activity's observer sees a valid native DataStore revision, a smaller
revision or different state at the *same* revision is treated as a terminal
storage-integrity failure. The coordinator invalidates previous grants and
refuses a new biometric prompt. Reads performed before and after biometrics
apply the same check, in case the Flow has not delivered the event yet.

This catches **in-process** rollback or inconsistent mutations only. It
cannot detect a file restored to an old valid revision before a new process
starts. Hardware-backed anti-rollback, key-bound authentication and real
Android QA remain separate security gates.
