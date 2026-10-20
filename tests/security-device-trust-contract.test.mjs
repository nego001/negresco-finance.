import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');

test('device trust never issues actual permissions or revives revoked keys', () => {
  const source=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticDeviceTrustLab.kt');
  assert.match(source,/DENY_REVOKED/);
  assert.match(source,/DENY_STALE_EPOCH/);
  assert.match(source,/DENY_STALE_REGISTRY_REVISION/);
  assert.match(source,/DENY_REPLAY_OR_INVALID_SEQUENCE/);
  assert.match(source,/DENY_UNTRUSTED_ANCHOR/);
  assert.match(source,/PROCEED_TO_INDEPENDENT_NATIVE_VERIFICATION/);
  assert.match(source,/compareAndSet\(current, updated\)/);
  assert.doesNotMatch(source,/\b(?:ALLOW|UNLOCKED|MASTER_KEY|SQLCIPHER_PASSWORD)\b/);
});

test('device registry proof and revision anchors remain explicitly experimental', () => {
  const source=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticDeviceTrustLab.kt');
  const tests=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticDeviceTrustLabTest.kt');
  const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
  const manifest=read('apps/mobile/app.json');
  assert.match(source,/TEST.ONLY substitution/i);
  assert.match(source,/not protect against process death, storage rollback/i);
  assert.match(tests,/for \(mask in 0 until 256\)/);
  assert.match(tests,/SYNTHETIC_SEQUENCE_RECORDED/);
  assert.match(tests,/DENY_REPLAY_OR_INVALID_SEQUENCE/);
  assert.match(tests,/CountDownLatch\(1\)/);
  assert.match(runner,/runSyntheticDeviceTrustScenarios\(\)/);
  assert.doesNotMatch(manifest,/SyntheticDeviceTrustLab|native-lock-spike/);
});
