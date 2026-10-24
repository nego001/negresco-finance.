import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const kotlin = 'tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/';
const fixtures = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';

test('SEC-05J rekeys actual synthetic records rather than just rewrapping the same DEK', () => {
  const source=read(kotlin+'SyntheticCompromisedKitRotationLab.kt');
  assert.match(source,/freshKey = ByteArray\(32\)/);
  assert.match(source,/rng\.nextBytes\(it\)/);
  assert.match(source,/SyntheticRecordCipherLab\.decryptFixtureOnly/);
  assert.match(source,/SyntheticRecordCipherLab\.encryptFixtureOnly/);
  assert.match(source,/SyntheticOfflineRecoveryKitCryptoLab\.sealFixtureOnly/);
  assert.match(source,/version \+ 1L, generation \+ 1L/);
  assert.match(source,/GCMParameterSpec\(128, nonce\)/);
  assert.match(source,/out\.writeLong\(version\)/);
  assert.match(source,/out\.writeLong\(generation\)/);
  assert.match(source,/out\.write\(name\)/);
  assert.match(source,/oldKey\.fill\(0\)/);
  assert.match(source,/freshKey\.fill\(0\)/);
});

test('SEC-05J single-process publication happens after full staged reencryption and verification', () => {
  const source=read(kotlin+'SyntheticCompromisedKitRotationLab.kt');
  const staged=source.indexOf('val staged = linkedMapOf');
  const verified=source.indexOf('val verified = SyntheticOfflineRecoveryKitCryptoLab');
  const publish=source.indexOf('records = staged.toMap()');
  assert.ok(staged > 0 && verified > staged && publish > verified);
  assert.match(source,/DENY_INJECTED_ABORT_NO_MUTATION/);
  assert.match(source,/DENY_CORRUPT_OLD_CIPHERTEXT/);
  assert.match(source,/DENY_EXPECTED_KIT_MISMATCH/);
  assert.match(source,/DENY_INVALID_BACKUP_OR_SECRET/);
  assert.match(source,/retired\.add\(oldId\)/);
  assert.match(source,/synchronized\(mutex\)/);
  assert.match(source,/old ciphertext remain decryptable OFFLINE|old DEK remain decryptable OFFLINE|Historical ciphertext/);
});

test('34 Kotlin regression scenarios and deliberate ciphertext corruption are isolated from Expo', () => {
  const source=read(fixtures+'SyntheticCompromisedKitRotationLabTest.kt');
  const runner=read(fixtures+'NativeLockCoordinatorTest.kt');
  const gradle=read('tooling/native-lock-spike/build.gradle.kts');
  const mobile=read('apps/mobile/package.json');
  const app=read('apps/mobile/app.json');
  assert.match(source,/PASS: SEC-05J 34 compromised-kit/);
  assert.match(source,/abortAt = 1/);
  assert.match(source,/abortAt = 2/);
  assert.match(source,/abortAt = 3/);
  assert.match(source,/corruptRecordFixtureOnly/);
  assert.match(source,/newFixedThreadPool\(8\)/);
  assert.match(source,/DENY_EXPECTED_KIT_MISMATCH/);
  assert.match(runner,/runSyntheticCompromisedKitRotationScenarios\(\)/);
  assert.match(gradle,/dependsOn\("policyCheck"\)/);
  assert.doesNotMatch(mobile,/SyntheticCompromisedKitRotationLab|native-lock-spike/);
  assert.doesNotMatch(app,/SyntheticCompromisedKitRotationLab|native-lock-spike/);
});

test('documentation admits immutable historical offline access and missing durable atomicity', () => {
  const doc=read('docs/security/SEC_05J_COMPROMISED_KIT_ROTATION_LAB.md');
  assert.match(doc,/SEC-05J/);
  assert.match(doc,/34 grupos/);
  assert.match(doc,/dados antigos/);
  assert.match(doc,/transação durável/);
  assert.match(doc,/autenticação forte/);
  assert.match(doc,/BLOQUEADO/);
});
