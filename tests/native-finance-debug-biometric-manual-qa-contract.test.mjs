import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const root = 'apps/mobile/modules/negresco-finance-security/android/';
const activity = read(root + 'src/debug/java/com/negresco/finance/security/SyntheticBiometricManualQaActivity.kt');
const manifest = read(root + 'src/debug/AndroidManifest.xml');
const testSource = read(root + 'src/androidTest/java/com/negresco/finance/security/SyntheticBiometricManualQaOptInTest.kt');
const gradle = read(root + 'build.gradle');
const main = read(root + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const ci = read('.github/workflows/ci.yml');
const executableActivity = activity
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test('biometric interactive QA is a nonexported DEBUG-only Activity, never a release app route', () => {
  assert.match(manifest, /android:name="com\.negresco\.finance\.security\.SyntheticBiometricManualQaActivity"/);
  assert.match(manifest, /android:exported="false"/);
  assert.doesNotMatch(read(root + 'src/main/AndroidManifest.xml'), /SyntheticBiometricManualQaActivity/);
  assert.doesNotMatch(main, /SyntheticBiometricManualQaActivity|BiometricPrompt|SecretKey|decrypt/);
  assert.match(gradle, /debugImplementation 'androidx\.biometric:biometric:1\.1\.0'/);
  assert.doesNotMatch(gradle, /^\s*implementation ['"]androidx\.biometric:biometric:/m);
  assert.match(activity, /class SyntheticBiometricManualQaActivity : FragmentActivity\(\)/);
  assert.match(activity, /setUserAuthenticationParameters\(0, KeyProperties\.AUTH_BIOMETRIC_STRONG\)/);
  assert.match(activity, /BiometricManager\.Authenticators\.BIOMETRIC_STRONG/);
  assert.match(activity, /BiometricPrompt\.CryptoObject\(cipher\)/);
  assert.match(activity, /result\.cryptoObject\?\.cipher !== cipher/);
  assert.match(activity, /Cipher\.ENCRYPT_MODE/);
  assert.match(activity, /Cipher\.DECRYPT_MODE/);
  assert.match(activity, /cancelAuthentication\(\)/);
  assert.match(activity, /promptConsumed = true/);
  assert.match(activity, /attempt != epoch \|\| promptConsumed/);
  assert.match(activity, /pendingNonce = nonce/);
  assert.match(activity, /pendingCiphertext = encrypted/);
  assert.match(activity, /pendingNonce\?\.fill\(0\)/);
  assert.match(activity, /pendingCiphertext\?\.fill\(0\)/);
  assert.match(activity, /DENY_BACKGROUND_OR_STOP/);
  assert.match(activity, /onStop\(\)/);
  assert.match(activity, /store\(\)\.deleteEntry/);
  assert.match(activity, /PASS_NATIVE_CRYPTO_ONLY/);
  assert.doesNotMatch(executableActivity, /SQLiteDatabase|sqlcipher|AsyncFunction\(|NetInfo|fetch\(/i);
});

test('unattended Android emulators cannot auto-approve biometric or run the interactive challenge', () => {
  assert.match(testSource, /assumeTrue\(/);
  assert.match(testSource, /negresco\.manual\.biometric/);
  assert.match(testSource, /YES_PHYSICAL_CONSENT/);
  assert.match(testSource, /manager\.isDeviceSecure/);
  assert.match(testSource, /ActivityScenario\.launch\(SyntheticBiometricManualQaActivity::class\.java\)/);
  assert.match(testSource, /completed\.await\(120, TimeUnit\.SECONDS\)/);
  assert.match(testSource, /assertEquals\("PASS_NATIVE_CRYPTO_ONLY", result\.get\(\)\)/);
  assert.doesNotMatch(ci, /YES_PHYSICAL_CONSENT/);
  assert.match(ci, /:negresco-finance-security:compileDebugAndroidTestKotlin/);
  assert.match(ci, /:negresco-finance-security:connectedDebugAndroidTest/);
});
