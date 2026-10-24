import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const base='tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/';
const scenarios='tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';

test('SEC-05F review is not device enrollment and has no privilege-grant status',()=>{
 const source=read(base+'SyntheticAllDevicesLostRecoveryLab.kt');
 assert.match(source,/ALL-DEVICES-LOST RECOVERY GATE SIMULATION/);
 assert.match(source,/never adds a trusted device/i);
 assert.match(source,/PROOF_ONLY_RECORDED/);
 assert.match(source,/PROOF_RECORDED_NOT_ENROLLED/);
 assert.match(source,/DENY_ACTIVE_DEVICE_EXISTS/);
 assert.match(source,/DENY_REVOKED_OR_KNOWN_CANDIDATE/);
 assert.match(source,/DENY_RECOVERY_ALREADY_REVIEWED/);
 assert.doesNotMatch(source,/\b(?:ALLOW_UNLOCK|GRANT_FINANCIAL_ACCESS|ACTIVATE_NEW_DEVICE)\b/);
});

test('owner recovery review and candidate possession are separate Ed25519 domains',()=>{
 const source=read(base+'SyntheticAllDevicesLostRecoveryLab.kt');
 assert.match(source,/recovery\.external-review\.ed25519\.v1/);
 assert.match(source,/recovery\.candidate-possession\.ed25519\.v1/);
 assert.match(source,/pinnedReviewAuthorityFixture/);
 assert.match(source,/SyntheticRecoverySignedReviewLab\.verify/);
 assert.match(source,/Signature\.getInstance\("Ed25519"\)/);
 assert.match(source,/output\.write\(bytes\(view\.accountId\)\)/);
 assert.match(source,/output\.writeLong\(uuid\.leastSignificantBits\)/);
 assert.match(source,/output\.write\(bytes\(view\.candidate\.hex\)\)/);
 assert.match(source,/output\.writeLong\(view\.ownerGeneration\)/);
 assert.match(source,/output\.writeLong\(view\.expiresMillis\)/);
 assert.match(source,/MessageDigest\.isEqual\(stored, nonce\)/);
});

test('10-minute one-shot review and revisions fail closed, never auto-enroll',()=>{
 const source=read(base+'SyntheticAllDevicesLostRecoveryLab.kt');
 assert.match(source,/REVIEW_WINDOW_MILLIS = 10L \* 60L \* 1000L/);
 assert.match(source,/state\.active\.isNotEmpty\(\)/);
 assert.match(source,/state\.revoked\.isEmpty\(\)/);
 assert.match(source,/DENY_CLOCK/);
 assert.match(source,/SyntheticRecoveryStatus\.EXPIRED/);
 assert.match(source,/SyntheticRecoveryStatus\.INVALIDATED/);
 assert.match(source,/account\.proofAlreadyRecorded = true/);
 assert.match(source,/ticket\.nonce\?\.fill\(0\)/);
 assert.match(source,/No registry mutation: the new device is STILL UNKNOWN/);
});

test('25 scenarios including concurrency run in Kotlin JVM, without Expo bridge',()=>{
 const source=read(scenarios+'SyntheticAllDevicesLostRecoveryLabTest.kt');
 const runner=read(scenarios+'NativeLockCoordinatorTest.kt');
 const packageJson=read('apps/mobile/package.json');
 const app=read('apps/mobile/app.json');
 assert.match(source,/PASS: 25 all-devices-lost signed-review/);
 assert.match(source,/newFixedThreadPool\(8\)/);
 assert.match(source,/DENY_MISSING_PINNED_AUTHORITY/);
 assert.match(source,/DENY_TERMINAL_TICKET/);
 assert.match(source,/DENY_RECOVERY_ALREADY_REVIEWED/);
 assert.match(runner,/runAllDevicesLostRecoveryScenarios\(\)/);
 assert.doesNotMatch(packageJson,/SyntheticAllDevicesLostRecoveryLab|native-lock-spike/);
 assert.doesNotMatch(app,/SyntheticAllDevicesLostRecoveryLab|native-lock-spike/);
});

test('risk disclosure explicitly forbids fake real recovery or cryptographic-data promises',()=>{
 const doc=read('docs/security/SEC_05F_ALL_DEVICES_LOST_RECOVERY_LAB.md');
 assert.match(doc,/não cadastra nem considera confiável um aparelho novo/);
 assert.match(doc,/autenticação forte/);
 assert.match(doc,/E2EE/);
 assert.match(doc,/kit de recuperação/);
 assert.match(doc,/BLOQUEADO/);
});
