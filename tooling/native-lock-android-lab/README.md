# Negresco Finance | Android native-lock lab

**EXPERIMENTAL LIBRARY, NOT THE MOBILE APP.** This Gradle Android library is
deliberately outside `apps/mobile` so that Expo autolinking does not
package it into Negresco Finance 3.1.2, OTA or any existing release.

## Components

- `NativeLockAndroidStore`: a single process-scoped Preferences DataStore
  instance for `negresco_native_lock.preferences_pb`. It exposes the internal
  repository to future native-only controllers, NOT to JavaScript.
- `StrongBiometricPrompt`: AndroidX BiometricPrompt, using only
  `BIOMETRIC_STRONG`, no device-credential fallback, with cancellation
  when its Activity stops or the coroutine is cancelled.
- Shared JVM-tested policy, legacy migration classifier and transactional
  `DataStoreLockRecordRepository` from `../native-lock-spike`.

## Build isolation

The GitHub CI job `native-lock-android-lab` compiles the Android library:

```bash
gradle -p tooling/native-lock-android-lab compileDebugKotlin --no-daemon
```

This is **compile verification**, not Samsung QA. It produces no APK,
registers no Expo module, installs nothing and does not migrate anyone's
settings. Dependency versions are explicit in the laboratory Gradle file.
The AndroidX Biometric library is pinned to the stable `1.1.0`.

## Native coroutine coordinator (experimental, not linked to Expo)

`NativeLockAndroidLabSession` now wires `StrongBiometricPrompt` and the
process-scoped DataStore to `SuspendingNativeLockCoordinator`. It observes
`onResume`/`onStop`, invalidates generations synchronously, serializes
biometric requests with a coroutine Mutex and binds the unlock to the DataStore
revision; a changed revision or invalid storage revokes the grant. The Activity-owned
coroutine also collects DataStore revisions and errors to revoke access without
waiting for an explicit snapshot read; an observation cannot authorize access.
Biometric
success callbacks require the Activity to remain `RESUMED`.

The new native coordinator supports **unlock and enable** in the isolated
laboratory. It **refuses disable**: the final transaction of removing local
protection is not yet linearizable with Android lifecycle revocation and must
not be exposed through a JS bridge. A successful BiometricPrompt result is
not a Keystore-protected cryptographic key authorization.

18 additional JVM scenarios cover cancellation, revoked sessions, stale
revisions, serialized prompts, enabled commit external revision changes, corrupt/missing native records and explicit disable denial.
The additional cases include live DataStore updates, missing records and
corruption, all of which must close a previously unlocked session. A failed
observation stream remains locked until explicit recovery; no real-device
biometric tests have been run.

## Not implemented and security limits

- A lab-only coordinator now connects native biometrics and DataStore for
  **unlock/enable** with generation/revision guards. It does not permit
  disabling protection or authorize any real SQLCipher/Keystore key.
- No user-facing setup flow for legacy `null`/`disabled` preferences.
  The current migration policy deliberately refuses to initialize those as
  `off`; preserving access requires a separate verified UX decision.
- No code reads old AsyncStorage records on-device. JS inputs must not be
  accepted as authoritative authentication proof.
- No rotation-safe owner, Expo module declaration, activity recovery,
  hardware-backed Keystore CryptoObject, SQLCipher, E2EE, or backup/recovery.
- BiometricPrompt lifecycle behavior still needs testing on a real Samsung
  with synthetic data, including prompt cancellation, app switching,
  fingerprint changes and process death.

**Next implementation gate:** verify native prompt lifecycle on a Samsung
with synthetic data; then design a safe native commit protocol for disabling
protection, native-only migration and durable key authorization. No unguarded
`compareAndSet` method in any JS bridge.
