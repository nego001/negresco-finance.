import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = 'apps/mobile/modules/negresco-finance-security/android/';
const kt = read(base + 'src/androidTest/java/com/negresco/finance/security/SyntheticKeystoreWrappedSqlcipherLifecycleTest.kt');
const module = read(base + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const gradle = read(base + 'build.gradle');
const app = read('apps/mobile/App.tsx');
const ci = read('.github/workflows/ci.yml');

test('Wrapped SQLCipher fixture stays instrumented, never a JavaScript financial key API', () => {
  assert.match(kt, /Android INSTRUMENTATION ONLY/);
  assert.match(kt, /class SyntheticKeystoreWrappedSqlcipherLifecycleTest/);
  assert.match(kt, /KeyStore\.getInstance\("AndroidKeyStore"\)/);
  assert.match(kt, /\.setUserAuthenticationRequired\(false\)/);
  assert.match(kt, /Cipher\.getInstance\("AES\/GCM\/NoPadding"\)/);
  assert.match(kt, /SQLiteDatabase\.openOrCreateDatabase/);
  assert.match(kt, /SQLiteDatabase\.OPEN_READONLY/);
  assert.match(module, /"financialStorageAllowed" to false/);
  assert.match(module, /"keyReleaseAllowed" to false/);
  assert.match(module, /"sqlcipherIntegrated" to false/);
  assert.doesNotMatch(module, /SQLiteDatabase|SecretKey|CryptoObject|wrap\(/);
  assert.doesNotMatch(app, /SyntheticKeystoreWrappedSqlcipherLifecycleTest/);
  assert.match(gradle, /androidTestImplementation 'net\.zetetic:sqlcipher-android:4\.19\.1'/);
  assert.doesNotMatch(gradle, /(?<!androidTest)implementation\s+['"]net\.zetetic:sqlcipher-android/);
});

test('Synthetic key lifecycle refuses tamper, wrong-account AAD and absent aliases', () => {
  assert.match(kt, /wrappedKeyReopensSyntheticSqlcipherAndTamperDoesNotOverwriteDatabase/);
  assert.match(kt, /lostKeystoreAliasCannotAutoReenrollOrEraseExistingCiphertext/);
  assert.match(kt, /cipher\.updateAAD\(binding\)/);
  assert.match(kt, /wrongAccountRejected/);
  assert.match(kt, /badTagRejected/);
  assert.match(kt, /assertArrayEquals\(envelope, envelopeFile\.readBytes\(\)\)/);
  assert.match(kt, /store\(\)\.deleteEntry\(alias\)/);
  assert.match(kt, /assertNull\("missing test alias means HOLD, never regenerate"/);
  assert.match(kt, /password\.fill\(0\)/);
  assert.match(kt, /cleanup\(root, database, alias\)/);
  assert.match(ci, /:negresco-finance-security:compileDebugAndroidTestKotlin/);
  assert.match(ci, /:negresco-finance-security:connectedDebugAndroidTest/);
});


test('Phase1 Keystore SQLCipher lifecycle slice remains synthetic AndroidTest, not Expo API', () => {
  const source = read(base + 'src/androidTest/java/com/negresco/finance/security/SyntheticKeystoreSqlcipherLifecycleBoundaryTest.kt');
  assert.match(source, /class SyntheticKeystoreSqlcipherLifecycleBoundaryTest/);
  assert.match(source, /setUserAuthenticationRequired\(false\)/);
  assert.match(source, /NativeLockLifecycleFence/);
  assert.match(source, /SQLiteDatabase\.OPEN_READONLY/);
  assert.match(source, /OBSERVED_FIXTURE_ONLY_NOT_AUTHORIZATION/);
  assert.match(source, /HOLD_TEST_PERMIT_OR_LIFECYCLE/);
  assert.match(source, /foregroundRevocationDeniesProtectedFixtureReadBeforeKeyRelease/);
  assert.match(source, /missingKeystoreAliasDoesNotRecreateOrEraseNativeCiphertext/);
  assert.match(source, /store\(\)\.deleteEntry\(f\.alias\)/);
  assert.doesNotMatch(source, /BiometricPrompt\.authenticate|financialStorageAllowed\s+to\s+true/);
  assert.doesNotMatch(module, /SyntheticKeystoreSqlcipherLifecycleBoundaryTest|openDatabase|KeyGenerator/);
});


test('synthetic native lifecycle slice must be present and executed in Android JUnit CI', () => {
  const auditor = read('tooling/sec05_android_junit_audit.py');
  assert.match(auditor, /SLICE_CLASS = 'com\.negresco\.finance\.security\.SyntheticKeystoreSqlcipherLifecycleBoundaryTest'/);
  assert.match(auditor, /SLICE_REQUIRED_CASES = frozenset/);
  assert.match(auditor, /missingKeystoreAliasDoesNotRecreateOrEraseNativeCiphertext/);
  assert.match(auditor, /foregroundRevocationDeniesProtectedFixtureReadBeforeKeyRelease/);
  assert.match(auditor, /native synthetic cipher slice has SKIPPED tests/);
});
