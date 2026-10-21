import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('a disposable invitation has a single durable terminal state, never active membership',()=>{
 const source=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticEnrollmentInviteDataStoreLab.kt');
 assert.match(source,/enum class SyntheticInviteStatus \{ PENDING, CONSUMED, CANCELLED \}/);
 assert.match(source,/suspend fun issue\(/);
 assert.match(source,/suspend fun consume\(/);
 assert.match(source,/suspend fun cancel\(/);
 assert.match(source,/store\.updateData \{ before ->/);
 assert.match(source,/SyntheticDeviceEnrollmentProofLab\.inspect\(/);
 assert.match(source,/SyntheticEnrollmentGate\.PROCEED_TO_INDEPENDENT_PERSISTENT_ENROLLMENT_PROTOCOL/);
 assert.match(source,/SyntheticInviteStatus\.CONSUMED\.name/);
 assert.match(source,/SyntheticInviteStatus\.CANCELLED\.name/);
 assert.match(source,/remove\(SyntheticInviteKeys\.pendingNonce\)/);
 assert.doesNotMatch(source,/\b(?:ALLOW|UNLOCKED|MASTER_KEY|SQLCIPHER_PASSWORD)\b/);
});

test('two-signature invites reject forgery, double-use, cancellation, races and reopen replay',()=>{
 const tests=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticEnrollmentInviteDataStoreLabTest.kt');
 const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
 const android=read('tooling/native-lock-android-lab/src/androidTest/kotlin/com/negresco/finance/security/NativeLockDataStoreInstrumentedTest.kt');
 assert.match(runner,/runPersistentEnrollmentInviteScenarios\(\)/);
 assert.match(tests,/PASS: 18 durable two-signature invite\/tombstone scenarios/);
 assert.match(tests,/is UnverifiedSyntheticInvite/);
 assert.match(tests,/is StaleSyntheticInvite/);
 assert.match(tests,/async\(Dispatchers.IO\)/);
 assert.match(tests,/reopened\.invites\.read/);
 assert.match(android,/dualSignedInvitationIsConsumedOnceAfterAndroidDataStoreReopen/);
 assert.match(android,/expiredDualSignedInvitePersistsTerminalTombstoneAfterAndroidReopen/);
 assert.equal((android.match(/@Test fun /g)||[]).length,17);
});

test('invitation ledger remains isolated from Expo, backend and real user registration',()=>{
 const src=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticEnrollmentInviteDataStoreLab.kt');
 const app=read('apps/mobile/package.json');
 const manifest=read('apps/mobile/app.json');
 assert.match(src,/NOT an enrollment service/);
 assert.match(src,/UNAUTHENTICATED TEST FIXTURES/);
 assert.match(src,/DataStore is NOT anti-rollback storage/);
 assert.match(src,/Neither state grants new-device trust/);
 assert.doesNotMatch(app,/SyntheticEnrollmentInviteDataStoreLab|native-lock-spike/);
 assert.doesNotMatch(manifest,/SyntheticEnrollmentInviteDataStoreLab|native-lock-spike/);
});
