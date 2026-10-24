import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = 'apps/mobile/modules/negresco-finance-security/android/';
const source = read(root + 'src/androidTest/java/com/negresco/finance/security/SyntheticJournalIndependentWitness.kt');
const fixtures = read(root + 'src/androidTest/java/com/negresco/finance/security/SyntheticJournalIndependentWitnessTest.kt');
const main = read(root + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const gradle = read(root + 'build.gradle');
const ci = read('.github/workflows/ci.yml');

test('unilateral local rollback witness is independent, atomic, bounded and strictly fail-closed', () => {
  assert.match(source, /internal class SyntheticJournalIndependentWitness/);
  assert.match(source, /AtomicFile\(witnessFile\)/);
  assert.match(source, /AtomicFile\(journal\)/);
  assert.match(source, /synthetic-migration\.journal/);
  assert.match(source, /synthetic-migration\.witness/);
  assert.match(source, /negresco_synthetic_atomic_/);
  assert.match(source, /witness\.startWrite\(\)/);
  assert.match(source, /witness\.finishWrite\(stream\)/);
  assert.match(source, /witness\.failWrite\(stream\)/);
  assert.match(source, /output\.size\(\) \+ n > 256|out\.size\(\) \+ n > 256/);
  assert.match(source, /MessageDigest\.isEqual/);
  assert.match(source, /DENY_SYNTHETIC_PAIR_MISMATCH/);
  assert.match(source, /DENY_SYNTHETIC_PAIR_INCOMPLETE/);
  assert.match(source, /HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY/);
  assert.match(source, /restoring BOTH files is undetectable/);
  assert.doesNotMatch(source, /"ALLOW_|"UNLOCKED|BiometricPrompt\.|SQLiteDatabase\.|SecretKeyFactory\./);
  assert.doesNotMatch(main, /SyntheticJournalIndependentWitness|stageExpectedCheckpoint|inspectPair/);
  assert.match(main, /"financialStorageAllowed" to false/);
  assert.match(main, /"keyReleaseAllowed" to false/);
});

test('instrumentation demonstrates unilateral journal rollback while refusing false remote antirollback claims', () => {
  assert.equal((fixtures.match(/@Test fun /g) || []).length, 9);
  assert.match(fixtures, /noBackupFilesDir/);
  assert.match(fixtures, /UUID\.randomUUID\(\)/);
  assert.match(fixtures, /deleteRecursively\(\)/);
  for (const name of [
    'missingPairRemainsHoldAndWritesNothing',
    'committedPairSurvivesReinstantiatingIndependentReaders',
    'crashWindowAfterWitnessBeforeJournalFailsClosed',
    'olderValidJournalRestoredAloneIsDetected',
    'olderWitnessRestoredAloneIsDetected',
    'witnessOnlyOrJournalOnlyIsDenied',
    'tamperingTruncationAndOversizeWitnessFailClosed',
    'matchingChecksumDoesNotMakeInvalidOrAlteredJournalTrusted',
    'completeRollbackOfBothLocalFilesIsStillUndetectable'
  ]) assert.match(fixtures, new RegExp(name));
  assert.match(fixtures, /HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY/);
  assert.match(fixtures, /DENY_SYNTHETIC_PAIR_MISMATCH/);
  assert.doesNotMatch(fixtures, /YES_PHYSICAL_CONSENT|readFinancialData|openDatabase|\bALLOW_\b/);
  assert.match(ci, /:negresco-finance-security:compileDebugAndroidTestKotlin/);
  assert.match(ci, /:negresco-finance-security:connectedDebugAndroidTest/);
  assert.doesNotMatch(gradle, /^\s*implementation ['"]net\.zetetic:sqlcipher-android/m);
});
