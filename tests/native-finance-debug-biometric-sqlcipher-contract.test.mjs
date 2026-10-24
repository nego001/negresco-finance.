import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const base = 'apps/mobile/modules/negresco-finance-security/android/';
const activity = read(base+'src/debug/java/com/negresco/finance/security/SyntheticBiometricSqlcipherManualQaActivity.kt');
const physical = read(base+'src/androidTest/java/com/negresco/finance/security/SyntheticBiometricSqlcipherManualQaOptInTest.kt');
const manifest = read(base+'src/debug/AndroidManifest.xml');
const gradle = read(base+'build.gradle');
const release = read(base+'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const workflow = read('.github/workflows/ci.yml');
const auditor = read('tooling/sec05_android_junit_audit.py');

test('DEBUG only two-prompt SQLCipher rehearsal is excluded from Release and never exposes a JS grant', () => {
  assert.match(manifest, /SyntheticBiometricSqlcipherManualQaActivity/);
  assert.match(manifest, /SyntheticBiometricSqlcipherManualQaActivity"\s+android:exported="false"/);
  assert.match(activity, /setUserAuthenticationRequired\(true\)/);
  assert.match(activity, /setUserAuthenticationParameters\(0, KeyProperties.AUTH_BIOMETRIC_STRONG\)/);
  assert.match(activity, /BiometricPrompt\.CryptoObject\(cipher\)/);
  assert.match(activity, /result\.cryptoObject\?\.cipher !== cipher/);
  assert.match(activity, /cipher\.doFinal\(password\)/);
  assert.match(activity, /cipher\.doFinal\(requireNotNull\(encrypted\)\)/);
  assert.match(activity, /SQLiteDatabase\.OPEN_READONLY/);
  assert.match(activity, /DENY_BACKGROUND/);
  assert.match(activity, /HOLD_CLEANUP_FAILED/);
  assert.match(activity, /store\(\)\.containsAlias\(name\)/);
  assert.match(activity, /dir\.deleteRecursively\(\) \|\| dir\.exists\(\)/);
  assert.match(activity, /HOLD_SQLCIPHER_LIBRARY_UNAVAILABLE/);
  assert.match(gradle, /debugImplementation 'net\.zetetic:sqlcipher-android:4\.19\.1'/);
  assert.doesNotMatch(gradle, /^  implementation 'net\.zetetic:sqlcipher-android/m);
  assert.doesNotMatch(release, /BiometricPrompt|SQLiteDatabase|SyntheticBiometricSqlcipherManualQaActivity/);
  assert.match(workflow, /SyntheticBiometricSqlcipherManualQaActivity/);
  assert.doesNotMatch(read(base+'src/main/AndroidManifest.xml'), /SyntheticBiometricSqlcipherManualQaActivity/);
});

test('genuine biometric positive is opt-in physical-only and never a CI pass', () => {
  assert.match(physical, /SyntheticPhysicalBiometricQaGate\.classify/);
  assert.match(physical, /negresco\.manual\.biometric\.sqlcipher/);
  assert.match(physical, /YES_PHYSICAL_CONSENT|HUMAN_REVIEW_REQUIRED_NOT_ATTESTED/);
  assert.match(physical, /done\.await\(120, TimeUnit\.SECONDS\)/);
  assert.match(auditor, /realBiometricTwiceThenSyntheticSqlcipherReopensWithNoJsAccess/);
  assert.doesNotMatch(workflow, /negresco\.manual\.biometric\.sqlcipher=YES_PHYSICAL_CONSENT/);
});


test('unattended QA checks nonexported launch without prompts or encrypted DB seeding', () => {
  const negative = read(base+'src/androidTest/java/com/negresco/finance/security/SyntheticBiometricSqlcipherQaIsolationTest.kt');
  assert.match(negative, /debugSqlcipherActivityLaunchCannotProvisionKeyOrSyntheticDatabase/);
  assert.match(negative, /ActivityScenario\.launch\(SyntheticBiometricSqlcipherManualQaActivity::class\.java\)/);
  assert.match(negative, /assertFalse\("test-only activity must not be exported", info\.exported\)/);
  assert.match(negative, /beforeKeys, aliases\(\)/);
  assert.match(negative, /beforeFolders/);
  assert.doesNotMatch(negative, /startManualQa\(|BiometricPrompt\.authenticate/);
  assert.match(auditor, /ISOLATION_CASE = 'debugSqlcipherActivityLaunchCannotProvisionKeyOrSyntheticDatabase'/);
});
