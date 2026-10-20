import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url),'utf8');

test('native-lock Android instrumented suite is gated behind PR and real emulator',()=>{
 const workflow=read('.github/workflows/ci.yml');
 const start=workflow.indexOf('  native-lock-android-emulator:');
 const end=workflow.indexOf('  sqlcipher-android-lab:',start);
 assert.ok(start > 0 && end > start, 'isolated Android emulator CI job must exist');
 const job=workflow.slice(start,end);
 assert.match(job,/if: github.event_name == 'pull_request'/);
 assert.match(job,/needs: native-lock-android-lab/);
 assert.match(job,/reactivecircus\/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d/);
 assert.match(job,/gradle -p tooling\/native-lock-android-lab connectedDebugAndroidTest/);
 assert.doesNotMatch(job,/stable_signing|gh release|assembleRelease|publish_release|adb install/);
});

test('native lock Android tests operate only on disposable no-backup fixtures',()=>{
 const source=read('tooling/native-lock-android-lab/src/androidTest/kotlin/com/negresco/finance/security/NativeLockDataStoreInstrumentedTest.kt');
 const gradle=read('tooling/native-lock-android-lab/build.gradle.kts');
 const mobile=read('apps/mobile/app.json');
 assert.match(gradle,/testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"/);
 assert.match(gradle,/androidTestImplementation\("androidx.test.ext:junit:1.2.1"\)/);
 assert.match(source,/targetContext.noBackupFilesDir/);
 assert.match(source,/UUID.randomUUID/);
 assert.match(source,/disablePending = true/);
 assert.match(source,/assertTrue\("Only lab fixture files are removed", isolatedDirectory.deleteRecursively\(\)\)/);
 assert.doesNotMatch(mobile,/native-lock-android-lab|NativeLockAndroidStore/);
});

test('thirteen native DataStore checks cover lock sessions and signed device challenge persistence',()=>{
 const source=read('tooling/native-lock-android-lab/src/androidTest/kotlin/com/negresco/finance/security/NativeLockDataStoreInstrumentedTest.kt');
 assert.equal((source.match(/@Test fun /g)||[]).length,13);
 assert.match(source,/deviceChallengePersistsAndSingleUseSurvivesReopeningRealDataStore/);
 assert.match(source,/fakeSignatureDoesNotConsumeDeviceChallengeOnRealDataStore/);
 assert.match(source,/racingValidSignedDeviceProofConsumesOneRealDataStoreTransaction/);
 assert.match(source,/deniedSecondAuthenticationRevokesPreviousGrantOnRealDataStore/);
 assert.match(source,/cancelledOptOutCannotRetainPriorGrantOrDisableRealDataStore/);
 assert.match(source,/absentPersistedRecordRevokesPreviouslyUnlockedSession/);
 assert.match(source,/malformedPersistedRecordRevokesPreviouslyUnlockedSession/);
 assert.match(source,/any real financial data|No record/i);
 assert.doesNotMatch(source,/fingerprint|biometricPrompt|AndroidKeyStore/);
});
