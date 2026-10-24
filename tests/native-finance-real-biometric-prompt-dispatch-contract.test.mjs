import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const base = 'apps/mobile/modules/negresco-finance-security/android/';
const harness = read(base + 'src/androidTest/java/com/negresco/finance/security/SyntheticBiometricPromptDispatchHarness.kt');
const tests = read(base + 'src/androidTest/java/com/negresco/finance/security/SyntheticBiometricPromptDispatchHarnessTest.kt');
const production = read(base + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const gradle = read(base + 'build.gradle');
const workflow = read('.github/workflows/ci.yml');
const executableTests = tests
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');


test('Biometric positive dispatcher uses real OS prompt and CryptoObject in test-only code', () => {
  assert.match(harness, /BiometricPrompt\.AuthenticationCallback/);
  assert.match(harness, /BiometricPrompt\(activity, activity\.mainExecutor, callback\)/);
  assert.match(harness, /prompt\.authenticate\(buildPrompt\(\), BiometricPrompt\.CryptoObject\(cipher\)\)/);
  assert.match(harness, /BiometricManager\.Authenticators\.BIOMETRIC_STRONG/);
  assert.match(harness, /userAuthenticationValidityDurationSeconds == -1/);
  assert.match(harness, /result\.cryptoObject\?\.cipher/);
  assert.match(harness, /returned !== attempt\.expectedCipher/);
  assert.match(harness, /expectedCipher\.doFinal\(attempt\.ciphertext\)/);
  assert.match(harness, /OBSERVED_NATIVE_CRYPTO_ONLY_NOT_FINANCIAL_PERMISSION/);
  assert.match(harness, /ciphertext\.fill\(0\)/);
  assert.match(harness, /aad\.fill\(0\)/);
  assert.match(harness, /old\?\.ciphertext\?\.fill\(0\)/);
  assert.match(harness, /old\?\.aad\?\.fill\(0\)/);
  assert.match(harness, /foreground.*lifecycle|lifecycle\.isStillDiagnosticEpoch/);
  assert.match(harness, /No return of plaintext\/key\/cipher to the Expo bridge/);
  assert.match(tests, /realPromptConfigurationExplicitlyPermitsStrongBiometricsOnly/);
  assert.match(tests, /SoftwareAesKeyCanNeverBecomeAcceptedBiometricKeystoreKey/);
});

test('positive prompt harness cannot accidentally become an app unlock API or run fake CI success', () => {
  assert.match(gradle, /androidTestImplementation 'androidx\.biometric:biometric:1\.1\.0'/);
  assert.doesNotMatch(gradle, /(?<!androidTest)implementation ['"]androidx\.biometric:/);
  assert.doesNotMatch(production, /BiometricPrompt|CryptoObject|requestWithRealOperatingSystemPrompt|SecretKey/);
  assert.match(production, /"financialStorageAllowed" to false/);
  assert.match(production, /"keyReleaseAllowed" to false/);
  assert.match(production, /"hardwareKeyAuthorizationIntegrated" to false/);
  assert.match(tests, /NO OS biometric approval is injected or forged/);
  assert.doesNotMatch(executableTests, /requestWithRealOperatingSystemPrompt\(/);
  assert.match(workflow, /:negresco-finance-security:compileDebugAndroidTestKotlin/);
  assert.match(workflow, /:negresco-finance-security:connectedDebugAndroidTest/);
});
