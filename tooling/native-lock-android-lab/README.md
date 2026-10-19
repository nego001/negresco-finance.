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

The Activity adapter executes safe `recoverPreparedDisable()` before it starts
observing the DataStore. A pending restart always rearms the lock; an error
keeps the observer gate closed.

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
process-scoped DataStore to `SuspendingNativeLockCoordinator` with `requireLiveObservation=true`. It observes
`onResume`/`onStop`, invalidates generations synchronously, serializes
biometric requests with a coroutine Mutex and binds the unlock to the DataStore
revision; a changed revision or invalid storage revokes the grant. The Activity-owned
coroutine also collects DataStore revisions and errors to revoke access without
waiting for an explicit snapshot read. Until the initial healthy emission,
biometric requests are denied. Missing/corrupt state or a failed/completed
observer permanently closes that Activity's authentication gate; new
observations cannot silently reopen it. A valid `enabled=false` record is
still observable and can be enabled via strong biometrics.
A revocation observation cannot grant access.
Biometric
success callbacks require the Activity to remain `RESUMED`.

The new native coordinator supports **unlock and enable** in the isolated
laboratory. It **refuses disable**: the final transaction of removing local
protection is not yet linearizable with Android lifecycle revocation and must
not be exposed through a JS bridge. A successful BiometricPrompt result is
not a Keystore-protected cryptographic key authorization.

28 additional JVM scenarios cover cancellation, revoked sessions, stale
revisions, serialized prompts, enabled commit external revision changes, corrupt/missing native records and explicit disable denial.
The additional cases include protected opt-out preparation/recovery, live DataStore updates, missing records and
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
`enableIfCurrent` repository operation in any JS bridge.

## Disable preparation gate (JVM-only, not wired to Activity)

The portable DataStore record now supports `disablePending` as a protected
intermediate state. `prepareDisable()` writes `enabled=true` and
`disablePending=true` **in one DataStore transaction** after the isolated
coordinator's simulated native biometric prompt. It returns `PREPARED`,
never `SUCCESS` or disabled. The actual `disable()` remains `DENIED`.

An interrupted or restarted preparation is always protected.
`recoverPreparedDisable()` clears the pending bit and increments the revision
without ever writing `enabled=false`. The repository refuses ordinary state
changes while pending; malformed `disabled+pending` records fail closed.

The preparation helper is **not exposed** by `NativeLockAndroidLabSession`
and does not reach Expo or the APK. Neither a complete opt-out transaction nor
Android Keystore-backed cryptographic authorization exists yet. The future
second phase needs to linearize lifecycle revocation against the durable
commit, plus physical-device tests.


## Cryptographic integrity prototype: NOT DATA ENCRYPTION

A separate, unlinked `AndroidKeystoreLockIntegrity` lab provides explicit
HMAC-SHA256 key provisioning for **synthetic test records only**, using the
AndroidKeyStore provider. Verification does **not** provision a key when
missing. The JVM helper `LockRecordIntegrity` uses deterministic, domain-
separated binary encoding, a 32-byte tag and timing-safe tag comparison.

This code is deliberately **not connected** to the Android lock record,
BiometricPrompt, the financial database or Expo. The lab key is not bound to
biometric user authentication and cannot protect financial data. HMAC detects
modified state but cannot reject replay of an older, correctly signed record.
The 15 synthetic JVM scenarios include an explicit successful replay to
ensure nobody mistakes a MAC for an anti-rollback primitive.

Do not publish any claim of Bitwarden-equivalent or stronger security until
the release gates in `docs/security/BITWARDEN_GRADE_SECURITY_GATES.md` have
independent evidence and appropriate external review.


## Financial record AES-GCM laboratory (not bank encryption)

`AndroidKeystoreFinancialEnvelopeLab` provisions a separate, explicitly
requested AES-256-GCM key in AndroidKeyStore for **synthetic disposable data**
only. It delegates bounded, versioned record encryption to the portable
`FinancialRecordEnvelopeV1` and does not provision during decryption.
A bad key, corrupt header, wrong record type/ID/revision or tag fails closed.

**Not biometric-authorized, not a SQLCipher page key, not production E2EE,
not exposed by the Activity adapter or Expo, and not tested on a Samsung.**
This laboratory does not make the installed APK's financial records encrypted.
The 23 synthetic JVM vector scenarios only test format and AEAD behavior.
See `docs/security/FINANCIAL_RECORD_ENVELOPE_LAB_V1.md`.
