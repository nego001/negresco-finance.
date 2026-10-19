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

## Not implemented and security limits

- No connected coordinator authorizes DataStore writes based on a biometrically
  authenticated **native** operation; the prompt returns only a candidate
  response that still needs session generation and revision validation.
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

**Next implementation gate:** a suspend-aware native coordinator that owns
biometric authentication, guards lifecycle invalidation, and serializes the
DataStore commit. No unguarded `compareAndSet` method in the JS bridge.
