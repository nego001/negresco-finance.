import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const kotlin = 'apps/mobile/modules/negresco-finance-security/android/';
const policy = read(kotlin + 'src/main/java/com/negresco/finance/security/NativeSyntheticOperationAttemptFence.kt');
const tests = read(kotlin + 'src/androidTest/java/com/negresco/finance/security/SyntheticOperationAttemptFenceTest.kt');
const expo = read(kotlin + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');

test('per-intent Kotlin attempt fence stays internal, typed, one-shot and deny-only', () => {
  assert.match(policy, /internal class NativeSyntheticOperationAttemptFence/);
  assert.match(policy, /READ_DISPOSABLE_FIXTURE/);
  assert.match(policy, /WRITE_DISPOSABLE_FIXTURE/);
  assert.match(policy, /consumedForegroundEpoch == epoch/);
  assert.match(policy, /lifecycle\.onBackground\(\)/);
  assert.match(policy, /lifecycle\.onDestroyed\(\)/);
  assert.match(policy, /NativeFinancialOperationPreflight\.evaluate\(/);
  const executable = policy.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /\b(?:ALLOW|GRANT|AUTHORIZED|APPROVED|UNLOCKED)\b|SQLiteDatabase|SecretKey|BiometricPrompt|CryptoObject|Cipher|getKey\(/);
  assert.doesNotMatch(expo, /NativeSyntheticOperationAttemptFence|READ_DISPOSABLE_FIXTURE|WRITE_DISPOSABLE_FIXTURE/);
  assert.match(expo, /"financialStorageAllowed" to false/);
  assert.match(expo, /"keyReleaseAllowed" to false/);
  assert.match(expo, /"migrationAllowed" to false/);
});

test('instrumentation covers native revocation, duplicate and forged observations', () => {
  const methods = [...tests.matchAll(/@Test fun ([A-Za-z0-9_]+)\s*\(/g)].map(m => m[1]);
  assert.deepEqual(methods, [
    'attemptWithoutForegroundCannotRun',
    'repeatedIntentInSameForegroundEpochAlwaysDenies',
    'backgroundAndDestroyRevokeSyntheticOperationEpoch',
    'forgedStrongCryptoAndStorageRemainDeniedForBothIntents'
  ]);
  assert.match(tests, /it[.]name[.]startsWith\("HOLD_"\)/);
});
