import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const moduleRoot = 'apps/mobile/modules/negresco-finance-security/android/';
const fixture = read(moduleRoot + 'src/androidTest/java/com/negresco/finance/security/SyntheticExpoSqlcipherPersistenceTest.kt');
const exposed = read(moduleRoot + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const gradle = read(moduleRoot + 'build.gradle');
const ci = read('.github/workflows/ci.yml');

test('Phase1 Expo SQLCipher stays in instrumentation only and never grants app storage', () => {
  assert.match(fixture, /class SyntheticExpoSqlcipherPersistenceTest/);
  assert.match(fixture, /System\.loadLibrary\("sqlcipher"\)/);
  assert.match(fixture, /SQLiteDatabase\.openOrCreateDatabase/);
  assert.match(fixture, /SQLiteDatabase\.OPEN_READONLY/);
  assert.match(fixture, /deleteRecursively\(\)/);
  assert.match(fixture, /SQLiteDatabase\.deleteDatabase/);
  assert.match(fixture, /NO|No user financial data/);
  assert.doesNotMatch(exposed, /net\.zetetic|SQLiteDatabase|System\.loadLibrary\("sqlcipher"\)/);
  assert.match(exposed, /"sqlcipherIntegrated" to false/);
  assert.match(exposed, /"financialStorageAllowed" to false/);
  assert.match(gradle, /androidTestImplementation 'net\.zetetic:sqlcipher-android:4\.19\.1'/);
  assert.match(gradle, /androidTestImplementation 'androidx\.sqlite:sqlite:2\.7\.0'/);
  assert.doesNotMatch(gradle, /(?<!androidTest)implementation\s+['"]net\.zetetic:sqlcipher-android/);
});

test('SQLCipher test enforces wrong key, reopen, atomic rollback and cleanup', () => {
  assert.match(fixture, /encryptedSyntheticRecordReopensWithCorrectKeyAndRejectsWrongKey/);
  assert.match(fixture, /uncommittedSyntheticTransactionDoesNotSurviveDatabaseReopen/);
  assert.match(fixture, /wrong key must never read the synthetic row/);
  assert.match(fixture, /getSyntheticValue\(again\)/);
  assert.match(fixture, /db\.beginTransaction\(\)/);
  assert.match(fixture, /db\.endTransaction\(\)/);
  assert.match(fixture, /assertEquals\(0, cursor\.getInt\(0\)\)/);
  assert.match(fixture, /finally \{\s*clearSandbox\(root, file\)/);
  assert.match(ci, /:negresco-finance-security:compileDebugAndroidTestKotlin/);
  assert.match(ci, /:negresco-finance-security:connectedDebugAndroidTest/);
});
