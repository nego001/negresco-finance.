import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const dir = 'apps/mobile/modules/negresco-finance-security/android/';
const service = read(dir + 'src/debug/java/com/negresco/finance/security/SyntheticJournalCrashWorkerService.kt');
const manifest = read(dir + 'src/debug/AndroidManifest.xml');
const tests = read(dir + 'src/androidTest/java/com/negresco/finance/security/SyntheticJournalActualProcessDeathTest.kt');
const mainManifest = read(dir + 'src/main/AndroidManifest.xml');
const module = read(dir + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const ci = read('.github/workflows/ci.yml');

test('real SIGKILL is confined to private non-exported debug worker process and disposable journal fixtures', () => {
  assert.match(manifest, /android:name="com\.negresco\.finance\.security\.SyntheticJournalCrashWorkerService"/);
  assert.match(manifest, /android:process=":negresco-synthetic-journal"/);
  assert.match(manifest, /android:exported="false"/);
  assert.doesNotMatch(mainManifest, /SyntheticJournalCrashWorkerService/);
  assert.doesNotMatch(module, /SyntheticJournalCrashWorkerService|SIGKILL|killProcess|writeCheckpoint/);
  assert.match(service, /class SyntheticJournalCrashWorkerService : Service\(\)/);
  assert.match(service, /Process\.killProcess\(Process\.myPid\(\)\)/);
  assert.match(service, /UUID\.fromString\(token\)/);
  assert.match(service, /noBackupFilesDir/);
  assert.match(service, /negresco_synthetic_atomic_\$token/);
  assert.match(service, /\.synthetic-test-owner/);
  assert.match(service, /AtomicFile\(/);
  assert.match(service, /AFTER_WITNESS/);
  assert.match(service, /DURING_JOURNAL/);
  assert.match(service, /AFTER_BOTH/);
  assert.match(service, /witness\.|synthetic-migration\.witness/);
  assert.doesNotMatch(service, /getExternalStorage|deleteRecursively|SQLiteDatabase|BiometricPrompt|http|AsyncStorage|openDatabase/);
});

test('instrumentation observes remote process death and reopen without ever authorizing migration', () => {
  assert.equal((tests.match(/@Test fun /g) || []).length, 3);
  assert.match(tests, /app\.bindService\(intent, connection, Context\.BIND_AUTO_CREATE\)/);
  assert.match(tests, /onServiceDisconnected/);
  assert.match(tests, /processDied\.await\(20, TimeUnit\.SECONDS\)/);
  assert.match(tests, /assertNotEquals\("worker must not kill instrumentation\/main process"/);
  assert.match(tests, /SyntheticJournalIndependentWitness\(root\)\.inspectPair\(\)/);
  assert.match(tests, /DENY_SYNTHETIC_PAIR_MISMATCH/);
  assert.match(tests, /HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY/);
  assert.match(tests, /deathAfterWitnessCommitRetainsDenyOnNewReader/);
  assert.match(tests, /deathWithPartiallyWrittenJournalDoesNotCommitNewCheckpoint/);
  assert.match(tests, /deathAfterBothCommittedAllowsOnlyDiagnosticHoldOnReopen/);
  assert.match(tests, /root\.deleteRecursively\(\)/);
  assert.doesNotMatch(tests, /YES_PHYSICAL_CONSENT|financialStorageAllowed.*true|ALLOW_MIGRATION/);
  assert.match(ci, /:negresco-finance-security:compileDebugAndroidTestKotlin/);
  assert.match(ci, /:negresco-finance-security:connectedDebugAndroidTest/);
  assert.match(ci, /:negresco-finance-security:bundleReleaseAar/);
  assert.match(ci, /SyntheticBiometricManualQaActivity\|SyntheticJournalCrashWorkerService/);
});
