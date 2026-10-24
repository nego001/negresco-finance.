import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const main = 'apps/mobile/modules/negresco-finance-security/android/src/main/java/com/negresco/finance/security/';
const instrument = 'apps/mobile/modules/negresco-finance-security/android/src/androidTest/java/com/negresco/finance/security/';
const classifier = read(main + 'NativeLockTypedSnapshotClassifier.kt');
const module = read(main + 'NegrescoFinanceSecurityV1Module.kt');
const fixture = read(instrument + 'SyntheticTypedNativeLockSnapshotTest.kt');
const gradle = read('apps/mobile/modules/negresco-finance-security/android/build.gradle');

test('typed classifier is native-only and rejects incomplete and pending states', () => {
  assert.match(classifier, /internal object NativeLockTypedSnapshotClassifier/);
  for (const key of ['negresco.lock.protocol_version', 'negresco.lock.enabled', 'negresco.lock.revision', 'negresco.lock.disable_pending'])
    assert.ok(classifier.includes(key), 'typed key must remain explicit: ' + key);
  for (const result of [
    'MISSING_REQUIRES_VERIFIED_MIGRATION', 'INVALID_LOCKED', 'UNSUPPORTED_VERSION_LOCKED',
    'PENDING_DISABLE_LOCKED', 'VALID_UNTRUSTED'
  ])
    assert.match(classifier, new RegExp(result));
  assert.doesNotMatch(classifier, /PreferenceDataStoreFactory|updateData\s*\(|FileInputStream|FileOutputStream|openDatabase|CryptoObject|BiometricPrompt|return\s+"UNLOCKED"/);
  assert.doesNotMatch(module, /NativeLockTypedSnapshotClassifier|readNativeLock|requestUnlock|requestDisable|readRecord|readSnapshot/);
  assert.match(gradle, /implementation 'androidx\.datastore:datastore-preferences-core:1\.2\.1'/);
});

test('Android typed read uses disposable no-backup fixture and never migrates personal data', () => {
  assert.match(fixture, /noBackupFilesDir/);
  assert.match(fixture, /UUID\.randomUUID\(\)/);
  assert.match(fixture, /"synthetic\.preferences_pb"/);
  assert.match(fixture, /PreferenceDataStoreFactory\.create/);
  assert.match(fixture, /store\.data\.first\(\)/);
  assert.match(fixture, /cancelAndJoin/);
  assert.match(fixture, /fixtureDir\.deleteRecursively\(\)/);
  assert.equal((fixture.match(/@Test fun /g) || []).length, 9);
  for (const scenario of [
    'missingSnapshotRequiresVerifiedMigration',
    'enabledSnapshotStillCannotBeTrustedToUnlock',
    'disabledSnapshotNeverBecomesAutomaticOptOut',
    'pendingDisableMustStayLocked',
    'contradictoryPendingDisableIsInvalid',
    'negativeRevisionIsInvalid',
    'unknownSchemaCannotBecomeUnlocked',
    'missingMandatoryFieldNeverCreatesDisabledPermission',
    'wrongStoredTypeCannotCrashOrUnlock'
  ]) assert.ok(fixture.includes(scenario), scenario);
  assert.doesNotMatch(fixture, /migrateLegacyLocked|requestUnlock|NativeLockAndroidStore|getIntegrationInfo|openDatabase|SqlCipher|BIOMETRIC_STRONG/);
  assert.match(gradle, /androidTestImplementation 'androidx\.datastore:datastore-preferences:1\.2\.1'/);
});
