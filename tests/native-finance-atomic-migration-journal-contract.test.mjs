import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const dir = 'apps/mobile/modules/negresco-finance-security/android/';
const source = read(dir + 'src/androidTest/java/com/negresco/finance/security/SyntheticAtomicMigrationJournal.kt');
const fixtures = read(dir + 'src/androidTest/java/com/negresco/finance/security/SyntheticAtomicMigrationJournalTest.kt');
const appModule = read(dir + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const existingGate = read(dir + 'src/main/java/com/negresco/finance/security/NativeLockMigrationInterruptionGate.kt');

test('AtomicFile migration journal is strictly androidTest-only, not exposed as a production write path', () => {
  assert.match(source, /internal class SyntheticAtomicMigrationJournal/);
  assert.match(source, /AtomicFile\(fixtureFile\)/);
  assert.match(source, /fixtureFile\.name == "synthetic-migration\.journal"/);
  assert.match(source, /atomic\.startWrite\(\)/);
  assert.match(source, /atomic\.finishWrite\(opened\)/);
  assert.match(source, /atomic\.failWrite\(opened\)/);
  assert.match(source, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(source, /output\.size\(\) \+ n > 256/);
  assert.match(source, /MessageDigest\.isEqual/);
  assert.match(source, /HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY/);
  assert.match(source, /HOLD_SYNTHETIC_CHECKPOINT_WRITTEN_NOT_AUTHORITY/);
  assert.doesNotMatch(source, /"ALLOW_|"UNLOCKED|"MIGRATED|"SUCCESS|BiometricPrompt|CryptoObject|SQLCipher|SQLiteDatabase|AndroidKeyStore/);
  assert.doesNotMatch(appModule, /SyntheticAtomicMigrationJournal|writeCheckpoint|interruptWriteBeforeCommit/);
  assert.doesNotMatch(existingGate, /SyntheticAtomicMigrationJournal/);
});

test('isolated no-backup Android tests exercise 8 real file checkpoints including rollback limitation', () => {
  assert.equal((fixtures.match(/@Test fun /g) || []).length, 8);
  assert.match(fixtures, /noBackupFilesDir/);
  assert.match(fixtures, /UUID\.randomUUID\(\)/);
  assert.match(fixtures, /sandbox\.deleteRecursively\(\)/);
  for (const scenario of [
    'missingJournalIsHoldAndDoesNotProvisionAnything',
    'checkpointSurvivesRecreatingReaderButStillDoesNotGrantAccess',
    'interruptedWriteRetainsLastCommittedFixture',
    'truncatedAndTamperedCheckpointsFailClosed',
    'oversizedAndInvalidUtf8JournalFailClosed',
    'legacyVersionAndInvalidStepNeverBecomeValid',
    'completedMarkerIsStillOnlyAnUntrustedSyntheticObservation',
    'validOlderCheckpointReplayIsNotDetectableByAnUnkeyedChecksum'
  ]) assert.match(fixtures, new RegExp(scenario));
  assert.doesNotMatch(fixtures,
    /AsyncStorage|PreferenceDataStoreFactory|LegacyLockedStore|BiometricPrompt|CryptoObject|SecretKey|openDatabase|readFinancialData/);
});
