import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');
const root = 'apps/mobile/modules/negresco-finance-security/android/';
const activity = read(root+'src/debug/java/com/negresco/finance/security/SyntheticBiometricSqlcipherManualQaActivity.kt');
const qa = read(root+'src/androidTest/java/com/negresco/finance/security/SyntheticDebugQaOrphanActivityBoundaryTest.kt');
const expo = read(root+'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');

test('crash residue scan runs before biometric availability and before key generation', () => {
  const start = activity.indexOf('fun startManualQa(');
  const orphan = activity.indexOf('SyntheticDebugQaOrphanResidueGate.isClear', start);
  const sensor = activity.indexOf('BiometricManager.from(this).canAuthenticate(', start);
  const generation = activity.indexOf('generator.generateKey()', start);
  assert.ok(start >= 0 && start < orphan && orphan < sensor && sensor < generation);
  assert.match(activity, /HOLD_ORPHANED_DEBUG_QA_RESIDUE/);
  assert.match(qa, /activity\.startManualQa\(null\)/);
  assert.match(qa, /assertEquals\("DEBUG QA: HOLD_ORPHANED_DEBUG_QA_RESIDUE", message\)/);
  assert.match(qa, /assertEquals\("A hold cannot mint an extra KeyStore alias"/);
  assert.doesNotMatch(expo, /SyntheticDebugQaOrphanActivityBoundaryTest/);
});

test('two Android methods assert live Activity HOLD and unrelated cache handling', () => {
  const found = [...qa.matchAll(/@Test fun ([A-Za-z0-9_]+)\s*\(/g)].map(x => x[1]);
  assert.deepEqual(found, [
    'orphanedFixtureFolderBlocksActivityBeforeBiometricPromptOrKeyCreation',
    'unrelatedCacheEntryCannotTriggerOrphanResidueDecision'
  ]);
});
