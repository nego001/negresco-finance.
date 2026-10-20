import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('signed authority floor and Ed25519 device proof share atomic ledger snapshot',()=>{
 const source=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticDeviceChallengeDataStoreLab.kt');
 const start=source.indexOf('  suspend fun consumeWithSignedAuthorityFloorForDisposableLab(');
 assert.ok(start>=0);
 const fn=source.slice(start);
 assert.match(fn,/store\.updateData \{ before ->/);
 assert.match(fn,/val view = decode\(before\)/);
 assert.match(fn,/SyntheticSignedTrustFloorLab\.inspect\(/);
 assert.match(fn,/SyntheticSignedDeviceProofLab\.verify\(/);
 assert.match(fn,/UnverifiedSyntheticAuthorityFloor/);
 assert.match(fn,/this\[SyntheticDeviceLedgerKeys\.lastSequence\] = claim\.sequence/);
 assert.match(fn,/remove\(SyntheticDeviceLedgerKeys\.challengeHex\)/);
 assert.match(source,/private val labTrustedAuthorityKey: PublicKey\? = null/);
 assert.doesNotMatch(fn,/\bALLOW\b|\bUNLOCKED\b/);
});

test('two-signature policy has 12 JVM and 15 isolated Android fixtures',()=>{
 const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
 const tests=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticSignedFloorLedgerIntegrationTest.kt');
 const android=read('tooling/native-lock-android-lab/src/androidTest/kotlin/com/negresco/finance/security/NativeLockDataStoreInstrumentedTest.kt');
 assert.match(runner,/runSignedAuthorityLedgerIntegrationScenarios\(\)/);
 assert.match(tests,/PASS: 12 signed-floor plus device-proof atomic DataStore scenarios/);
 assert.match(tests,/is UnverifiedSyntheticAuthorityFloor/);
 assert.match(tests,/is UnverifiedSyntheticDeviceProof/);
 assert.match(tests,/runCatching/);
 assert.match(android,/signedAuthorityAndDeviceProofConsumeOneAndroidDataStoreCounter/);
 assert.equal((android.match(/@Test fun /g)||[]).length,15);
});

test('authority proof integration stays detached from Expo and production keys',()=>{
 const code=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticDeviceChallengeDataStoreLab.kt');
 const manifest=read('apps/mobile/app.json');
 const pkg=read('apps/mobile/package.json');
 assert.match(code,/There is no authenticated provisioning or real backend/);
 assert.match(code,/caller-supplied remote/);
 assert.doesNotMatch(manifest,/SyntheticSignedTrustFloorLab|SyntheticDeviceChallengeDataStoreLab|native-lock-spike/);
 assert.doesNotMatch(pkg,/SyntheticSignedTrustFloorLab|SyntheticDeviceChallengeDataStoreLab|native-lock-spike/);
});
