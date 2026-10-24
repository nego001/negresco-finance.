import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const base = 'apps/mobile/modules/negresco-finance-security/android/';
const fence = read(base+'src/main/java/com/negresco/finance/security/NativeSyntheticCallbackDenialFence.kt');
const qa = read(base+'src/androidTest/java/com/negresco/finance/security/SyntheticCallbackDenialFenceTest.kt');
const expo = read(base+'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');

test('native callback rehearsal consumes before trust, never grants or exports', () => {
  assert.match(fence, /internal class NativeSyntheticCallbackDenialFence/);
  assert.match(fence, /if \(receipt !== expected\)/);
  assert.match(fence, /if \(intent != expected.intent\)/);
  assert.match(fence, /pending = null/);
  assert.match(fence, /HOLD_NATIVE_AUTHORITY_NOT_IMPLEMENTED/);
  const executable = fence.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /\b(?:ALLOW|GRANT|AUTHORIZED|APPROVED|UNLOCKED)\b|SQLiteDatabase|SecretKey|BiometricPrompt|CryptoObject|Cipher|getKey\(/);
  assert.doesNotMatch(expo, /NativeSyntheticCallbackDenialFence|SyntheticCallbackDenialFenceTest|observeUntrustedCallback/);
  for (const field of ['financialStorageAllowed','keyReleaseAllowed','migrationAllowed']) {
    assert.match(expo, new RegExp('"'+field+'"\\s+to\\s+false'));
  }
});

test('six Android negative scenarios are explicit and not disabled', () => {
  const methods = [...qa.matchAll(/@Test fun ([A-Za-z0-9_]+)\s*\(/g)].map(x=>x[1]);
  assert.deepEqual(methods, [
    'callbackWithoutPendingAttemptIsDenied',
    'forgedSuccessWithMatchingIntentAndReceiptCannotAuthorize',
    'wrongIntentBurnsAttemptAndCorrectedReplayIsDenied',
    'staleReceiptAfterBackgroundCannotConsumeNewEpoch',
    'cancelledClaimAndPreflightFailureCannotTurnIntoApproval',
    'destructionAndDuplicateForegroundNeverResurrectReceipt'
  ]);
  assert.match(qa, /it.name.startsWith\("HOLD_"\)/);
});
