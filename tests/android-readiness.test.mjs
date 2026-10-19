import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),'utf8');

test('SQLCipher and zero-knowledge are formally assigned only to Negresco Finance',()=>{
 const adr=read('docs/decisions/0001-sqlcipher-zero-knowledge-negresco-only.md');
 const phase=read('docs/PHASE1_BASELINE.md');
 assert.match(adr,/somente no repositório/);
 assert.match(adr,/Security Black/);
 assert.match(adr,/não significa que o SQLCipher/);
 assert.match(phase,/ADR 0001/);
});

test('Android readiness tool is read-only and checks package metadata',()=>{
 const source=read('tooling/windows/android-v31-readonly-preflight.ps1');
 assert.match(source,/\[CmdletBinding\(\)\]/);
 assert.match(source,/Get-FileHash/);
 assert.match(source,/adb\.exe/);
 assert.match(source,/shell pm path \$packageName/);
 assert.match(source,/shell dumpsys package \$packageName/);
 assert.doesNotMatch(source,/\badb\s+(?:install|uninstall|push)\b/i);
 assert.doesNotMatch(source,/shell\s+pm\s+clear\b/i);
 assert.doesNotMatch(source,/shell\s+rm\s+-/i);
});

test('Samsung manual QA checklist explicitly protects installed app data',()=>{
 const qa=read('docs/ANDROID_QA_V3.1.md');
 assert.match(qa,/QA-21/);
 assert.match(qa,/QA-22/);
 assert.match(qa,/não desinstalar antes/i);
});

test('Windows update verifier compares installed public APK identity without device writes',()=>{
 const source=read('tooling/windows/compare-installed-apk.ps1');
 assert.match(source,/\[CmdletBinding\(\)\]/);
 assert.match(source,/Find-AndroidTool 'apksigner'/);
 assert.match(source,/Find-AndroidTool 'aapt'/);
 assert.match(source,/shell pm path \$packageName/);
 assert.match(source,/pull \$deviceApk \$localCopy/);
 assert.match(source,/Remove-Item -LiteralPath \$localCopy -Force/);
 assert.match(source,/\$installedCert -cne \$candidateCert/);
 assert.match(source,/\$candidate\.VersionCode -le \$installed\.VersionCode/);
 assert.match(source,/\$packageName='com\.negresco\.finance'/);
 assert.doesNotMatch(source,/shell\s+pm\s+(?:clear|uninstall|install)\b/i);
 assert.doesNotMatch(source,/&\s+\$adb(?:\.Source)?[^\n]*\b(?:install|uninstall|push|root|remount)\b/i);
});
test('PowerShell 5.1 parser audit covers both read-only Windows tools',()=>{
 const workflow=read('.github/workflows/windows-readonly-tools-check.yml');
 assert.match(workflow,/windows-latest/);
 assert.match(workflow,/windows\/compare-installed-apk\.ps1/);
 assert.match(workflow,/windows\/android-v31-readonly-preflight\.ps1/);
 assert.match(workflow,/Parser\]::ParseFile/);
});

test('native lock Kotlin spike is isolated from APK and checked in CI',()=>{
 const path='tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/NativeLockCoordinator.kt';
 const source=read(path);
 const nativeCheck=read('.github/workflows/ci.yml');
 const config=read('apps/mobile/app.json');
 assert.match(source,/internal interface AtomicLockStore/);
 assert.match(source,/internal fun interface NativeBiometricVerifier/);
 assert.match(source,/private var promptInFlight = false/);
 assert.match(source,/generation\+\+/);
 assert.match(nativeCheck,/native-lock-spike:/);
 const datastore=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/DataStoreLockRecordRepository.kt');
 const gradle=read('tooling/native-lock-spike/build.gradle.kts');
 assert.match(datastore,/class DataStoreLockRecordRepository/);
 assert.match(datastore,/dataStore\.updateData/);
 assert.match(datastore,/throw MissingNativeLockRecord\(\)/);
 assert.match(datastore,/throw InvalidNativeLockRecord\(\)/);
 assert.match(gradle,/datastore-preferences-core:1\.2\.1/);
 assert.match(nativeCheck,/gradle -p tooling\/native-lock-spike policyCheck --no-daemon/);
 assert.doesNotMatch(config,/NegrescoNativeLock|NativeLockCoordinator/);
});

test('experimental Android native lock cannot be invoked from Expo 3.1.2',()=>{
 const androidBuild=read('tooling/native-lock-android-lab/build.gradle.kts');
 const provider=read('tooling/native-lock-android-lab/src/main/kotlin/com/negresco/finance/security/NativeLockAndroidStore.kt');
 const prompt=read('tooling/native-lock-android-lab/src/main/kotlin/com/negresco/finance/security/StrongBiometricPrompt.kt');
 const migration=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/LegacyLockMigrationPolicy.kt');
 const store=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/DataStoreLockRecordRepository.kt');
 const mobile=read('apps/mobile/app.json');
 const workflow=read('.github/workflows/ci.yml');
 assert.match(androidBuild,/id\("com\.android\.library"\)/);
 assert.match(provider,/internal object NativeLockAndroidStore/);
 assert.match(provider,/@Volatile private var instance/);
 assert.match(prompt,/BiometricManager\.Authenticators\.BIOMETRIC_STRONG/);
 assert.match(prompt,/override fun onStop\(owner: LifecycleOwner\)/);
 assert.match(prompt,/prompt\?\.cancelAuthentication\(\)/);
 assert.match(migration,/NEEDS_EXPLICIT_SETUP/);
 assert.match(store,/suspend fun migrateLegacyLocked/);
 assert.match(store,/LegacyLockMigrationDecision\.NEEDS_EXPLICIT_SETUP/);
 assert.match(workflow,/native-lock-android-lab:/);
 assert.doesNotMatch(mobile,/native-lock-android-lab|NativeLockAndroidStore|StrongBiometricPrompt/);
});

test('native coroutine coordinator is lifecycle-gated and cannot disable protection',()=>{
 const policy=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SuspendingNativeLockCoordinator.kt');
 const host=read('tooling/native-lock-android-lab/src/main/kotlin/com/negresco/finance/security/NativeLockAndroidLabSession.kt');
 const app=read('apps/mobile/App.tsx');
 assert.match(policy,/private val requestMutex = Mutex\(\)/);
 assert.match(policy,/fun onBackground\(\) = synchronized\(lifecycleGuard\)/);
 assert.match(policy,/private fun finishUnlocked\(ticket: Long, revision: Long\): LockResult = synchronized\(lifecycleGuard\)/);
 assert.match(policy,/suspend fun enable\(\): LockResult = requestMutex\.withLock/);
 assert.match(policy,/suspend fun unlock\(\): LockResult = requestMutex\.withLock/);
 assert.match(policy,/suspend fun disable\(\): LockResult = LockResult\.DENIED/);
 assert.match(policy,/private var unlockedRevision: Long\? = null/);
 assert.match(policy,/unlockedRevision != record\.revision/);
 assert.match(policy,/unlockedRevision == record\.revision/);
 assert.match(policy,/unlockedRevision = null/);

 assert.match(host,/StrongBiometricPrompt\(activity\)/);
 assert.match(host,/SuspendingNativeLockCoordinator\(/);
 assert.match(host,/override fun onStop\(owner: LifecycleOwner\)/);
 assert.match(read('tooling/native-lock-android-lab/src/main/kotlin/com/negresco/finance/security/StrongBiometricPrompt.kt'),
   /complete\(activity\.lifecycle\.currentState\.isAtLeast\(Lifecycle\.State\.RESUMED\)\)/);

 assert.doesNotMatch(host,/suspend fun disable/);
 assert.doesNotMatch(app,/NativeLockAndroidLabSession|SuspendingNativeLockCoordinator/);
});

test('native DataStore observation revokes sessions but cannot grant access',()=>{
 const store=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/DataStoreLockRecordRepository.kt');
 const coordinator=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SuspendingNativeLockCoordinator.kt');
 const host=read('tooling/native-lock-android-lab/src/main/kotlin/com/negresco/finance/security/NativeLockAndroidLabSession.kt');
 assert.match(store,/fun observe\(\): Flow<NativeLockObservation>/);
 assert.match(store,/NativeLockObservation\.StorageError/);
 assert.match(store,/\.distinctUntilChanged\(\)/);
 assert.match(coordinator,/fun onPersistentStateChanged\(event: NativeLockObservation\)/);
 assert.match(coordinator,/unlockedRevision != record\.revision/);
 assert.match(host,/\.observe\(\)\.collect/);
 assert.match(host,/requireLiveObservation = true/);
 assert.match(host,/coordinator\.onPersistentStateChanged\(NativeLockObservation\.StorageError\)/);
 assert.match(coordinator,/private var observationReady = !requireLiveObservation/);
 assert.match(coordinator,/private var observationFailed = false/);
 assert.match(coordinator,/observationReady = false/);
 assert.match(coordinator,/observationFailed = true/);
 assert.match(coordinator,/foreground && observationReady && !observationFailed/);
 assert.match(host,/coordinator\.onPersistentStateChanged\(event\)/);
 assert.match(host,/observationScope\.cancel\(\)/);
 assert.match(coordinator,/suspend fun disable\(\): LockResult = LockResult\.DENIED/);
});

test('opt-out preparation never commits native disabled state or exposes a JS bridge',()=>{
 const policy=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/NativeLockCoordinator.kt');
 const store=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/DataStoreLockRecordRepository.kt');
 const coordinator=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SuspendingNativeLockCoordinator.kt');
 const androidHost=read('tooling/native-lock-android-lab/src/main/kotlin/com/negresco/finance/security/NativeLockAndroidLabSession.kt');
 assert.match(policy,/disablePending: Boolean = false/);
 assert.match(policy,/PREPARED/);
 assert.match(store,/val disablePending = booleanPreferencesKey/);
 assert.match(store,/suspend fun prepareDisable\(expectedRevision: Long\)/);
 assert.match(store,/suspend fun recoverPreparedDisable\(\)/);
 assert.match(store,/this\[NativeLockDataStoreKeys\.enabled\] = true/);
 assert.match(store,/this\[NativeLockDataStoreKeys\.disablePending\] = true/);
 assert.match(store,/if \(previous\.disablePending\) throw PendingNativeLockDisable\(\)/);
 assert.match(coordinator,/suspend fun prepareDisableForLab\(\): LockResult = requestMutex\.withLock/);
 assert.match(coordinator,/biometric\.authenticate\(LockAction\.DISABLE\)/);
 assert.match(coordinator,/LockResult\.PREPARED/);
 assert.match(coordinator,/suspend fun disable\(\): LockResult = LockResult\.DENIED/);
 assert.match(androidHost,/repository\.recoverPreparedDisable\(\)/);
 assert.doesNotMatch(androidHost,/prepareDisableForLab|suspend fun disable/);
});

test('legacy Kotlin policy cannot bypass native opt-out denial',()=>{
 const sync=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/NativeLockCoordinator.kt');
 const asyncPolicy=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SuspendingNativeLockCoordinator.kt');
 const faults=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/OptOutInterleavingTest.kt');
 const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
 assert.match(sync,/if \(action == LockAction\.DISABLE\) return LockResult\.DENIED/);
 assert.doesNotMatch(sync,/val enabled = action == LockAction\.ENABLE/);
 assert.match(sync,/private var unlockedRevision: Long\? = null/);
 assert.match(sync,/record\.revision != unlockedRevision/);
 assert.match(asyncPolicy,/suspend fun disable\(\): LockResult = LockResult\.DENIED/);
 assert.match(asyncPolicy,/val sessionStillValid = stillValid\(ticket\)/);
 assert.match(asyncPolicy,/if \(!sessionStillValid\) return@withLock LockResult\.STALE/);
 assert.match(faults,/pauseAfterCommit = false/);
 assert.match(faults,/pauseAfterCommit = true/);
 assert.match(faults,/attempt\.cancelAndJoin\(\)/);
 assert.match(runner,/runOptOutInterleavingScenarios\(\)/);
});
