import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const root = 'apps/mobile/modules/negresco-finance-security/android/';
const testKt = read(root + 'src/androidTest/java/com/negresco/finance/security/SyntheticNativeKeystoreRoundTripTest.kt');
const mainKt = read(root + 'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const gradle = read(root + 'build.gradle');
const workflow = read('.github/workflows/ci.yml');
const app = read('apps/mobile/App.tsx');

test('AndroidKeyStore test has emulator-only source and no JS-visible key or data access', () => {
  assert.ok(testKt.includes('class SyntheticNativeKeystoreRoundTripTest'));
  assert.ok(testKt.includes('KeyStore.getInstance("AndroidKeyStore")'));
  assert.ok(testKt.includes('Cipher.getInstance("AES/GCM/NoPadding")'));
  assert.ok(testKt.includes('KeyProperties.BLOCK_MODE_GCM'));
  assert.ok(testKt.includes('.setUserAuthenticationRequired(false)'));
  assert.ok(testKt.includes('keystore().deleteEntry(alias)'));
  assert.ok(testKt.includes('AEADBadTagException'));
  assert.ok(testKt.includes('NOT app feature, NOT a persistent vault'));
  assert.ok(mainKt.includes('AsyncFunction("getIntegrationInfo")'));
  assert.equal([...mainKt.matchAll(/AsyncFunction\("([^"]+)"\)/g)].length, 1);
  assert.ok(!mainKt.includes('AndroidKeyStore'));
  assert.ok(!mainKt.includes('doFinal('));
  assert.ok(!app.includes('SyntheticNativeKeystoreRoundTripTest'));
});

test('CI compiles and runs the test-only module on disposable Android emulator', () => {
  assert.ok(gradle.includes("testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'"));
  assert.ok(gradle.includes("androidTestImplementation 'androidx.test.ext:junit:1.2.1'"));
  assert.ok(workflow.includes('expo-native-diagnostic-compile:'));
  assert.ok(workflow.includes(':negresco-finance-security:compileDebugAndroidTestKotlin'));
  assert.ok(workflow.includes('expo-native-diagnostic-emulator:'));
  assert.ok(workflow.includes(':negresco-finance-security:connectedDebugAndroidTest'));
  assert.ok(workflow.includes("needs: expo-native-diagnostic-compile"));
  assert.ok(workflow.includes("if: github.event_name == 'pull_request'"));
  assert.ok(!testKt.includes('getIntegrationInfo()'));
});
