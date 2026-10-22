import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = 'apps/mobile/modules/negresco-finance-security/android/src/';
const source = read(base + 'main/java/com/negresco/finance/security/NativeLockReadOnlySnapshotReader.kt');
const fixture = read(base + 'androidTest/java/com/negresco/finance/security/SyntheticReadOnlyNativeLockReaderTest.kt');
const api = read(base + 'main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const gradle = read('apps/mobile/modules/negresco-finance-security/android/build.gradle');

test('Phase1 typed DataStore reader accepts injected owner and never creates a production store', () => {
  assert.match(source, /internal class NativeLockReadOnlySnapshotReader/);
  assert.match(source, /private val store: DataStore<Preferences>/);
  assert.match(source, /store\.data\.first\(\)/);
  assert.match(source, /NativeLockTypedSnapshotClassifier\.classify/);
  assert.match(source, /CancellationException/);
  assert.match(source, /throw cancelled/);
  assert.match(source, /"STORAGE_ERROR_LOCKED"/);
  assert.doesNotMatch(source, /PreferenceDataStoreFactory|DataStoreFactory|updateData|File\(|Context|openDatabase|CryptoObject|BiometricPrompt|SqlCipher|SecretKey|unlock|grantAccess/);
  assert.doesNotMatch(api, /NativeLockReadOnlySnapshotReader|inspectOnce|readNativeLockState|requestUnlock|requestDisable/);
});

test('Read-only fixture tests a single disposable DataStore instance and fail-closed statuses', () => {
  assert.match(fixture, /noBackupFilesDir/);
  assert.match(fixture, /UUID\.randomUUID\(\)/);
  assert.match(fixture, /PreferenceDataStoreFactory\.create/);
  assert.equal((fixture.match(/PreferenceDataStoreFactory\.create/g) || []).length, 1);
  assert.match(fixture, /fixture\.preferences_pb/);
  assert.match(fixture, /cancelAndJoin/);
  assert.match(fixture, /sandbox\.deleteRecursively\(\)/);
  assert.equal((fixture.match(/@Test fun /g) || []).length, 5);
  for (const scenario of [
    'missingRecordDemandsVerifiedMigrationWithoutSeeding',
    'enabledAndDisabledSnapshotsAreNeverAuthorizations',
    'pendingDisableAlwaysStaysLocked',
    'wrongTypedPreferenceNeverGrantsAccess',
    'concurrentReadCallsShareOneFixtureDataStoreAndNeverMutate',
  ]) assert.ok(fixture.includes(scenario), scenario);
  assert.match(fixture, /MISSING_REQUIRES_VERIFIED_MIGRATION/);
  assert.match(fixture, /VALID_UNTRUSTED/);
  assert.match(fixture, /PENDING_DISABLE_LOCKED/);
  assert.match(fixture, /INVALID_LOCKED/);
  assert.doesNotMatch(fixture, /negresco_native_lock\.preferences_pb|NativeLockAndroidStore|migrateLegacyLocked|requestUnlock|openDatabase|readFinancialData/);
  assert.match(gradle, /datastore-preferences-core:1\.2\.1/);
});
