import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const root = 'apps/mobile/modules/negresco-finance-security/android/';
const qa = get(root+'src/androidTest/java/com/negresco/finance/security/SyntheticCallbackAdversarialSequencesTest.kt');
const module = get(root+'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');

test('adversarial Android suite locks four named methods and bounded deterministic inputs', () => {
  const methods = [...qa.matchAll(/@Test fun ([A-Za-z0-9_]+)\s*\(/g)].map(x => x[1]);
  assert.deepEqual(methods, [
    'hundredsOfForgedSuccessCallbacksNeverAuthorize',
    'crossIntentInjectionConsumesAttemptBeforeCorrection',
    'invalidatedForegroundAndDestroyedSessionsAlwaysRejectLateCallbacks',
    'randomizedClaimsNeverProduceAReceiptAfterDeniedPreflight',
  ]);
  assert.match(qa, /repeat\(256\)/);
  assert.match(qa, /repeat\(512\)/);
  assert.match(qa, /java\.util\.Random\(0x5EEDL\)/);
  assert.match(qa, /it\.name\.startsWith\("HOLD_"\)|decision\.name\.startsWith\("HOLD_"\)/);
});

test('adversarial fixture never opens a native financial gateway', () => {
  assert.doesNotMatch(module, /SyntheticCallbackAdversarialSequencesTest|SyntheticCallbackDenialFence/);
  assert.doesNotMatch(qa, /BiometricPrompt|CryptoObject|SQLiteDatabase|SecretKey|import net\.zetetic/);
});
