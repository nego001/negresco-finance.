import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const base = 'apps/mobile/modules/negresco-finance-security/android/';
const activity = read(base+'src/debug/java/com/negresco/finance/security/SyntheticBiometricSqlcipherManualQaActivity.kt');
const guard = read(base+'src/debug/java/com/negresco/finance/security/SyntheticDebugQaOrphanResidueGate.kt');
const qa = read(base+'src/androidTest/java/com/negresco/finance/security/SyntheticDebugQaOrphanResidueGateTest.kt');
const expo = read(base+'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');

test('Debug QA checks orphaned Keystore aliases and cache before provisioning new fixture', () => {
  const check = activity.indexOf('SyntheticDebugQaOrphanResidueGate.isClear');
  const load = activity.indexOf('System.loadLibrary("sqlcipher")');
  const generate = activity.indexOf('generator.generateKey()');
  assert.ok(check >= 0 && check < load && load < generate);
  assert.match(activity, /HOLD_ORPHANED_DEBUG_QA_RESIDUE/);
  assert.match(activity, /requireNotNull\(cacheDir.listFiles\(\)\)/);
  assert.match(activity, /store\(\)\.aliases\(\)\.toList\(\)/);
  assert.match(guard, /negresco_debug_sqlcipher_/);
  assert.match(guard, /negresco_qa_sqlcipher_/);
  assert.match(guard, /keystoreAliases.none \{ it.startsWith\(ALIAS_PREFIX\) \}/);
  assert.match(guard, /cacheEntries.none \{ it.startsWith\(FOLDER_PREFIX\) \}/);
  assert.doesNotMatch(expo, /SyntheticDebugQaOrphanResidueGate/);
});

test('orphan residue guard requires four nominal Android denial cases', () => {
  const names = [...qa.matchAll(/@Test fun ([A-Za-z0-9_]+)\s*\(/g)].map(x => x[1]);
  assert.deepEqual(names, [
    'noResidualKeysOrFoldersPermitsOnlyPreparingManualQa',
    'survivingKeystoreAliasAfterProcessDeathBlocksNewQa',
    'survivingSqlcipherCacheFolderAfterProcessDeathBlocksNewQa',
    'unrelatedKeysDoNotMaskAnySyntheticQaResidue'
  ]);
});
