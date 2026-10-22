import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = 'apps/mobile/modules/negresco-finance-security/android/';
const fixture = read(root + 'src/androidTest/java/com/negresco/finance/security/SyntheticCryptoObjectCallbackFirewallTest.kt');
const module = read(root + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const gradle = read(root + 'build.gradle');
const workflow = read('.github/workflows/ci.yml');

test('CryptoObject cannot become trusted just by a success callback or JS flag', () => {
  assert.match(fixture, /Android INSTRUMENTATION ONLY|NEGATIVE CryptoObject boundary, androidTest only/);
  assert.match(fixture, /BiometricPrompt\.CryptoObject/);
  assert.match(fixture, /SecretKeyFactory\.getInstance\("AES", "AndroidKeyStore"\)/);
  assert.match(fixture, /info\.isUserAuthenticationRequired/);
  assert.match(fixture, /userAuthenticationValidityDurationSeconds != -1/);
  assert.match(fixture, /result\?\.cipher !== attempt\.expectedCipher/);
  assert.match(fixture, /attempt\.expectedCipher\.doFinal/);
  assert.match(fixture, /OBSERVED_CRYPTO_ONLY_NOT_AUTHORIZATION/);
  assert.match(fixture, /fabricatedCryptoObjectCannotTurnASoftwareKeyIntoAndroidAuthorization/);
  assert.match(fixture, /missingBiometricEnrollmentCannotCreateAUsableApprovalToken/);
  assert.match(fixture, /DENY_STALE_FOREGROUND/);
  assert.match(fixture, /DENY_BAD_OR_REPLAYED_CALLBACK/);
  assert.match(fixture, /store\(\)\.deleteEntry\(alias\)/);
  assert.doesNotMatch(fixture, /BiometricPrompt\.authenticate\(/);
  assert.doesNotMatch(module, /BiometricPrompt|CryptoObject|SecretKeyFactory|AUTH_BIOMETRIC_STRONG/);
  assert.match(module, /"financialStorageAllowed" to false/);
  assert.match(module, /"keyReleaseAllowed" to false/);
  assert.match(module, /"hardwareKeyAuthorizationIntegrated" to false/);
});

test('Expo test-only AndroidX biometric dependency and emulator execution remain isolated', () => {
  assert.match(gradle, /androidTestImplementation 'androidx\.biometric:biometric:1\.1\.0'/);
  assert.doesNotMatch(gradle, /(?<!androidTest)implementation ['"]androidx\.biometric:biometric:/);
  assert.match(workflow, /:negresco-finance-security:compileDebugAndroidTestKotlin/);
  assert.match(workflow, /:negresco-finance-security:connectedDebugAndroidTest/);
});
