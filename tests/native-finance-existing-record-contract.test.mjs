import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const prefix = 'apps/mobile/modules/negresco-finance-security/android/';
const owner = read(prefix + 'src/main/java/com/negresco/finance/security/NativeLockExistingRecordDiagnostic.kt');
const bridge = read(prefix + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const fixture = read(prefix + 'src/androidTest/java/com/negresco/finance/security/SyntheticExistingRecordDiagnosticGateTest.kt');
const gradle = read(prefix + 'build.gradle');
const js = read('apps/mobile/security/nativeFinanceReadiness.ts');

test('Phase1 reuses one Android Context DataStore delegate and never seeds missing user preferences', () => {
  assert.match(owner, /private val Context\.negrescoExistingLockDiagnostic by preferencesDataStore\(/);
  assert.match(owner, /name = "negresco_native_lock"/);
  assert.match(owner, /NativeLockFilePresenceDiagnostic\.inspect\(app\)/);
  assert.match(owner, /presence != "PRESENT_UNVERIFIED"/);
  assert.match(owner, /"ABSENT" -> "MISSING_REQUIRES_VERIFIED_MIGRATION"/);
  assert.match(owner, /"UNSAFE_ENTRY" -> "STORAGE_ERROR_LOCKED"/);
  assert.match(owner, /NativeLockReadOnlySnapshotReader/);
  assert.match(owner, /isStillDiagnosticEpoch\(epoch\)/);
  assert.doesNotMatch(owner, /PreferenceDataStoreFactory|updateData|edit\s*\{|SharedPreferences|delete\(|FileOutputStream|openDatabase|SecretKey|CryptoObject|BiometricPrompt|SqlCipher/);
  assert.match(gradle, /implementation 'androidx\.datastore:datastore-preferences:1\.2\.1'/);
});

test('SDK54 public typed snapshot inspection remains suspend-only and never grants key/database rights', () => {
  assert.match(bridge, /AsyncFunction\("inspectExistingNativeLockRecord"\) Coroutine \{ ->/);
  assert.match(bridge, /import expo\.modules\.kotlin\.functions\.Coroutine/);
  assert.match(bridge, /NativeLockExistingRecordDiagnostic\.classifyExisting\(/);
  const methods = [...bridge.matchAll(/AsyncFunction\("([^"]+)"\)/g)].map(m => m[1]);
  assert.deepEqual(methods, [
    'getIntegrationInfo', 'inspectNativeLockStorePresence', 'inspectExistingNativeLockRecord'
  ]);
  for (const field of ['financialStorageAllowed', 'keyReleaseAllowed', 'migrationAllowed'])
    assert.match(bridge, new RegExp('"' + field + '"\\s+to\\s+false'));
  assert.doesNotMatch(bridge, /requestUnlock|requestDisable|Cipher\.getInstance|SQLiteDatabase|SecretKey/);
  assert.match(js, /inspectExistingNativeLockRecord/);
  assert.match(js, /recordDiagnostic: NativeRecordDiagnostic/);
  assert.match(js, /financialStorageAllowed: false/);
  assert.match(js, /keyReleaseAllowed: false/);
  assert.match(js, /migrationAllowed: false/);
});

test('context absent, background and destruction are rejected without touching a real DataStore', () => {
  assert.equal((fixture.match(/@Test fun /g) || []).length, 3);
  assert.match(fixture, /backgroundCannotReadEvenWithAndroidContext/);
  assert.match(fixture, /missingContextCannotStartNativeStorageRead/);
  assert.match(fixture, /destroyedActivityCannotBeReusedByNativeReader/);
  assert.doesNotMatch(fixture, /updateData|openDatabase|createDatabase|PreferenceDataStoreFactory|File\(|Keystore|SecretKey/);
});
