import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const root='apps/mobile/modules/negresco-finance-security/android/';
const scan=read(root+'src/debug/java/com/negresco/finance/security/SyntheticDebugQaOrphanInspection.kt');
const activity=read(root+'src/debug/java/com/negresco/finance/security/SyntheticBiometricSqlcipherManualQaActivity.kt');
const tests=read(root+'src/androidTest/java/com/negresco/finance/security/SyntheticDebugQaOrphanInspectionTest.kt');
const expo=read(root+'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');

test('synthetic inspection fails closed for thrown or null inventory', () => {
  assert.match(scan,/catch \(_: Exception\) \{ return Decision\.HOLD_INSPECTION_UNAVAILABLE \}/);
  assert.match(scan,/\?: return Decision\.HOLD_INSPECTION_UNAVAILABLE/);
  assert.match(scan,/SyntheticDebugQaOrphanResidueGate\.isClear/);
  assert.match(activity,/HOLD_DEBUG_INSPECTION_UNAVAILABLE/);
  assert.match(activity,/SyntheticDebugQaOrphanInspection\.inspect\(/);
  assert.doesNotMatch(expo,/SyntheticDebugQaOrphanInspection/);
});
test('five real Android methods exercise enumeration faults and deny orphan residues',()=>{
  const names=[...tests.matchAll(/@Test fun ([A-Za-z0-9_]+)\s*\(/g)].map(m=>m[1]);
  assert.deepEqual(names,[
    'missingCacheListingCannotBeTreatedAsEmptyStorage',
    'thrownAndroidKeystoreEnumerationNeverProceedsToQa',
    'thrownCacheEnumerationNeverProceedsToQa',
    'suspectAliasOrFolderAlwaysBlocksNextDebugQa',
    'cleanNamesPermitOnlyManualDebugPreparationNotFinancialAccess'
  ]);
});
