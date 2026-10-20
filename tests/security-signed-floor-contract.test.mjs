import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('remote floor witness is signature-bound to the device and a fresh challenge',()=>{
 const code=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticSignedTrustFloorLab.kt');
 assert.match(code,/Signature\.getInstance\("Ed25519"\)/);
 assert.match(code,/MessageDigest\.isEqual\(freshClientChallenge, returnedChallenge\)/);
 assert.match(code,/output\.writeLong\(claim\.revision\)/);
 assert.match(code,/output\.writeLong\(claim\.epoch\)/);
 assert.match(code,/output\.writeLong\(claim\.minLastSequence\)/);
 assert.match(code,/output\.write\(challenge\)/);
 assert.match(code,/DENY_MISSING_AUTHORITY/);
 assert.match(code,/DENY_ROLLED_BACK_SEQUENCE/);
 assert.match(code,/DENY_ROLLED_BACK_REVISION/);
 assert.match(code,/DENY_ROLLED_BACK_EPOCH/);
 assert.doesNotMatch(code,/\b(?:ALLOW|UNLOCKED|MASTER_KEY|SQLCIPHER_PASSWORD)\b/);
});

test('signed remote floor is not declared a trusted backend or anti-rollback storage',()=>{
 const code=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticSignedTrustFloorLab.kt');
 const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
 const tests=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticSignedTrustFloorLabTest.kt');
 const mobile=read('apps/mobile/package.json');
 assert.match(code,/NO trusted issuer/);
 assert.match(code,/Offline replay\/rollback still requires a different protected anchor/);
 assert.match(code,/Only accept trustedAuthorityPublicKey when it was pinned\/provisioned/);
 assert.match(runner,/runSignedAuthorityFloorScenarios\(\)/);
 assert.match(tests,/PASS: 22 signed remote-floor anti-rollback witness scenarios/);
 assert.doesNotMatch(mobile,/SyntheticSignedTrustFloorLab|native-lock-spike/);
});
