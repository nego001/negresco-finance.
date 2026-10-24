import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('new device enrollment needs signed approval and independent candidate proof',()=>{
 const source=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticDeviceEnrollmentProofLab.kt');
 assert.match(source,/approvalDomain/);
 assert.match(source,/possessionDomain/);
 assert.match(source,/Signature\.getInstance\("Ed25519"\)/);
 assert.match(source,/alreadyApprovedDeviceKey/);
 assert.match(source,/candidateDeviceKey/);
 assert.match(source,/SyntheticSignedDeviceProofLab\.fingerprint/);
 assert.match(source,/MessageDigest\.isEqual\(issuedChallenge, returnedChallenge\)/);
 assert.match(source,/DENY_UNTRUSTED_APPROVER/);
 assert.match(source,/DENY_DUPLICATE_OR_REVOKED_CANDIDATE/);
 assert.match(source,/DENY_APPROVAL_SIGNATURE/);
 assert.match(source,/DENY_CANDIDATE_SIGNATURE/);
 assert.match(source,/PROCEED_TO_INDEPENDENT_PERSISTENT_ENROLLMENT_PROTOCOL/);
 assert.doesNotMatch(source,/\b(?:ALLOW|ENROLLED|UNLOCKED|SQLCIPHER_PASSWORD|MASTER_KEY)\b/);
});

test('dual-signature enrollment lab cannot silently register a device in Expo',()=>{
 const source=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticDeviceEnrollmentProofLab.kt');
 const tests=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticDeviceEnrollmentProofLabTest.kt');
 const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
 const mobile=read('apps/mobile/package.json');
 assert.match(source,/No enrollment server/);
 assert.match(source,/No.*hardware keys|hardware keys/i);
 assert.match(tests,/PASS: 20 dual-signature device enrollment preflight scenarios/);
 assert.match(runner,/runSyntheticDeviceEnrollmentProofScenarios\(\)/);
 assert.doesNotMatch(mobile,/SyntheticDeviceEnrollmentProofLab|native-lock-spike/);
});
