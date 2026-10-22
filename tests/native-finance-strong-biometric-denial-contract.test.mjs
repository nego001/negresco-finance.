import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = 'apps/mobile/modules/negresco-finance-security/android/';
const fixture = read(root + 'src/androidTest/java/com/negresco/finance/security/SyntheticStrongBiometricKeyDenialTest.kt');
const main = read(root + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const workflow = read('.github/workflows/ci.yml');
const gradle = read(root + 'build.gradle');

test('native Android per-operation strong biometric fixture never enables financial JS grant', () => {
  assert.match(fixture, /AndroidKeyStore/);
  assert.match(fixture, /\.setUserAuthenticationRequired\(true\)/);
  assert.match(fixture, /\.setUserAuthenticationParameters\(0, KeyProperties\.AUTH_BIOMETRIC_STRONG\)/);
  assert.match(fixture, /\.setInvalidatedByBiometricEnrollment\(true\)/);
  assert.match(fixture, /strongBiometricKeyCannotEncryptWithoutCryptoObjectAuthentication/);
  assert.match(fixture, /encryptedWithoutAuthorization = true/);
  assert.match(fixture, /assertFalse\("never encrypt without strong biometric CryptoObject consent"/);
  assert.match(fixture, /store\(\)\.deleteEntry\(alias\)/);
  assert.match(fixture, /Some clean emulators have no enrolled strong biometric/);
  assert.doesNotMatch(fixture, /BiometricPrompt\.authenticate\(/);
  assert.doesNotMatch(fixture, /setUserAuthenticationRequired\(false\)/);
  assert.match(main, /"financialStorageAllowed" to false/);
  assert.match(main, /"keyReleaseAllowed" to false/);
  assert.match(main, /"hardwareKeyAuthorizationIntegrated" to false/);
  assert.doesNotMatch(main, /BiometricPrompt|AUTH_BIOMETRIC_STRONG|CryptoObject|SecretKey|openDatabase/);
});

test('test-only Android instrumentation compiles and runs without release biometric rights', () => {
  assert.match(gradle, /testInstrumentationRunner 'androidx\.test\.runner\.AndroidJUnitRunner'/);
  assert.match(workflow, /:negresco-finance-security:compileDebugAndroidTestKotlin/);
  assert.match(workflow, /:negresco-finance-security:connectedDebugAndroidTest/);
  assert.match(workflow, /expo-native-diagnostic-emulator:/);
});
