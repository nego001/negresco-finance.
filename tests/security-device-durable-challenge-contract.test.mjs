import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('single-use device challenge is bound to the same DataStore transaction as counter',()=>{
 const lab=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticDeviceChallengeDataStoreLab.kt');
 assert.match(lab,/class SyntheticDeviceChallengeDataStoreLab/);
 assert.match(lab,/fun seedForDisposableLab\(/);
 assert.match(lab,/fun issue\(/);
 assert.match(lab,/fun consume\(/);
 assert.match(lab,/SecureRandom\(\)/);
 assert.match(lab,/SyntheticSignedDeviceProofLab\.verify\(/);
 assert.match(lab,/remove\(SyntheticDeviceLedgerKeys\.challengeHex\)/);
 assert.match(lab,/this\[SyntheticDeviceLedgerKeys\.lastSequence\] = claim\.sequence/);
 assert.match(lab,/store\.updateData/);
 assert.match(lab,/if \(view\.pending != null\) throw PendingSyntheticDeviceChallenge/);
 assert.match(lab,/if \(pending\.claim != claim\) throw StaleSyntheticDeviceLedger/);
 assert.doesNotMatch(lab,/\b(?:ALLOW|UNLOCKED|MASTER_KEY|SQLCIPHER_PASSWORD)\b/);
});

test('signed challenges survive isolated emulator restarts and fail closed after replay',()=>{
 const tests=read('tooling/native-lock-android-lab/src/androidTest/kotlin/com/negresco/finance/security/NativeLockDataStoreInstrumentedTest.kt');
 assert.match(tests,/deviceChallengePersistsAndSingleUseSurvivesReopeningRealDataStore/);
 assert.match(tests,/racingValidSignedDeviceProofConsumesOneRealDataStoreTransaction/);
 assert.match(tests,/fakeSignatureDoesNotConsumeDeviceChallengeOnRealDataStore/);
 assert.match(tests,/cancelledSignedChallengeStaysInvalidAcrossAndroidDataStoreReopen/);
 assert.match(tests,/targetContext.noBackupFilesDir/);
 assert.match(tests,/isolatedDirectory.deleteRecursively\(\)/);
});

test('durable ledger is neither an Expo module nor a protected monotonic trust anchor',()=>{
 const doc=read('docs/security/NEGRESCO_SECURITY_ENGINE_IMPLEMENTATION_PLAN.md');
 const code=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticDeviceChallengeDataStoreLab.kt');
 const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
 const mobile=read('apps/mobile/package.json');
 assert.match(doc,/DataStore/);
 assert.match(code,/DO NOT provide rollback resistance/);
 assert.match(code,/unauthenticated fingerprint/);
 assert.match(runner,/runSyntheticDeviceLedgerScenarios\(\)/);
 assert.doesNotMatch(mobile,/SyntheticDeviceChallengeDataStoreLab|native-lock-spike/);
});
