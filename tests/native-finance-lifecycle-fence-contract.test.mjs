import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const root = 'apps/mobile/modules/negresco-finance-security/android/src/';
const gate = read(root + 'main/java/com/negresco/finance/security/NativeLockLifecycleFence.kt');
const reader = read(root + 'main/java/com/negresco/finance/security/NativeLockReadOnlySnapshotReader.kt');
const module = read(root + 'main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const fixtures = read(root + 'androidTest/java/com/negresco/finance/security/SyntheticNativeLifecycleRevocationTest.kt');
const readFixture = read(root + 'androidTest/java/com/negresco/finance/security/SyntheticReadOnlyNativeLockReaderTest.kt');

test('Expo SDK54 lifecycle events revoke native diagnostic epochs, never confer finance authority', () => {
  assert.match(module, /OnActivityEntersForeground\s*\{\s*diagnosticLifecycle\.onForeground\(\)/);
  assert.match(module, /OnUserLeavesActivity\s*\{\s*diagnosticLifecycle\.onBackground\(\)/);
  assert.match(module, /OnActivityEntersBackground\s*\{\s*diagnosticLifecycle\.onBackground\(\)/);
  assert.match(module, /OnActivityDestroys\s*\{\s*diagnosticLifecycle\.onDestroyed\(\)/);
  assert.match(module, /OnDestroy\s*\{\s*diagnosticLifecycle\.onDestroyed\(\)/);
  assert.match(module, /private val diagnosticLifecycle = NativeLockLifecycleFence\(\)/);
  assert.match(module, /val epoch = diagnosticLifecycle\.beginDiagnosticEpoch\(\)/);
  assert.match(module, /val status = if \(epoch != null && diagnosticLifecycle\.isStillDiagnosticEpoch\(epoch\)\)/);
  assert.match(module, /untrustedStatus else "UNAVAILABLE"/);

  assert.match(gate, /@Synchronized fun beginDiagnosticEpoch\(\): Long\?/);
  assert.match(gate, /@Synchronized fun isStillDiagnosticEpoch\(epoch: Long\): Boolean/);
  assert.match(gate, /generation == epoch/);
  assert.match(gate, /generation == Long\.MAX_VALUE/);
  assert.doesNotMatch(gate, /SecretKey|CryptoObject|Cipher|SQLiteDatabase|Keystore|BiometricPrompt|unlock\(|grantAccess\(|disableLock\(|updateData/);
  const exported = [...module.matchAll(/AsyncFunction\("([^"]+)"\)/g)].map(x => x[1]);
  assert.deepEqual(exported, ['getIntegrationInfo', 'inspectNativeLockStorePresence']);
});

test('read-only DataStore snapshot is rejected when Activity leaves during an asynchronous read', () => {
  assert.match(reader, /private val lifecycle: NativeLockLifecycleFence/);
  assert.match(reader, /beginDiagnosticEpoch\(\) \?: return "LIFECYCLE_REVOKED_LOCKED"/);
  assert.match(reader, /isStillDiagnosticEpoch\(epoch\)/);
  assert.match(reader, /"LIFECYCLE_REVOKED_LOCKED"/);
  assert.match(reader, /"STORAGE_ERROR_LOCKED"/);
  assert.match(reader, /throw cancelled/);
  assert.match(fixtures, /completedReadFromPriorForegroundMustBeDiscarded/);
  assert.match(fixtures, /started\.await\(\)/);
  assert.match(fixtures, /fence\.onBackground\(\)/);
  assert.match(fixtures, /release\.complete\(Unit\)/);
  assert.match(fixtures, /LIFECYCLE_REVOKED_LOCKED/);
  assert.equal((fixtures.match(/@Test fun /g) || []).length, 5);
  assert.match(readFixture, /NativeLockReadOnlySnapshotReader\(datastore, lifecycle\)/);
  assert.doesNotMatch(fixtures, /File\(|PreferenceDataStoreFactory|SecretKey|CryptoObject|requestUnlock|openDatabase/);
});
