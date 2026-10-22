import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = 'apps/mobile/modules/negresco-finance-security/';
const definition = JSON.parse(read(base + 'expo-module.config.json'));
const module = read(base + 'android/src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const gradle = read(base + 'android/build.gradle');
const host = read(base + 'src/NegrescoFinanceSecurityV1.ts');
const app = read('apps/mobile/App.tsx');
const packageJson = JSON.parse(read('apps/mobile/package.json'));
const executableModule = module
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');


test('Phase1 local Expo module is Android-only and registered with explicit module name', () => {
  assert.deepEqual(definition.platforms, ['android']);
  assert.deepEqual(definition.android.modules,
    ['com.negresco.finance.security.NegrescoFinanceSecurityV1Module']);
  assert.match(module, /class NegrescoFinanceSecurityV1Module : Module\(\)/);
  assert.match(module, /Name\("NegrescoFinanceSecurityV1"\)/);
  // Expo SDK 54 uses ExpoModulesCorePlugin.gradle; the newer Gradle plugin
  // ID belongs to a different SDK and must not be silently mixed in.
  assert.match(gradle, /ExpoModulesCorePlugin\.gradle/);
  assert.match(gradle, /applyKotlinExpoModulesCorePlugin\(\)/);
  assert.match(gradle, /useCoreDependencies\(\)/);
  assert.doesNotMatch(gradle, /apply plugin: 'expo-module-gradle-plugin'/);
  assert.match(gradle, /apply plugin: 'com.android.library'/);
  assert.match(host, /requireOptionalNativeModule\('NegrescoFinanceSecurityV1'\)/);
  assert.match(app, /getOptionalNativeFinanceDiagnosticHost\(\)/);
  assert.doesNotMatch(app, /NativeModules\.NegrescoFinanceSecurityV1/);
});

test('Phase1 native surface is strictly diagnostic, no financial access operations', () => {
  const functions = [...module.matchAll(/\bAsyncFunction\("([^"]+)"\)/g)]
    .map(match => match[1]);
  assert.deepEqual(functions, ['getIntegrationInfo', 'inspectNativeLockStorePresence', 'inspectExistingNativeLockRecord']);
  assert.match(module, /"moduleKind" to "DIAGNOSTIC_ONLY"/);
  for (const name of [
    'financialStorageAllowed', 'keyReleaseAllowed', 'migrationAllowed',
    'sqlcipherIntegrated', 'hardwareKeyAuthorizationIntegrated'
  ]) {
    assert.match(module, new RegExp('"' + name + '"\\s+to\\s+false'));
  }
  assert.doesNotMatch(module, /Function\("(?:open|unlock|disable|enable|migrate|write|save|load|readData|decrypt)/i);
  // The bridge may name the read-only singleton, but must not create
  // a store, update preferences, expose credentials or open a database.
  assert.doesNotMatch(executableModule, /SecretKey|Cipher\.getInstance|net\.zetetic|openDatabase|DataStoreFactory|PreferenceDataStoreFactory|updateData|BiometricPrompt|CryptoObject|passphrase/i);
  assert.match(module, /AsyncFunction\("inspectExistingNativeLockRecord"\) Coroutine \{ ->/);
  assert.doesNotMatch(executableModule, /SuspendBody/);
  assert.doesNotMatch(module, /getIntegrationInfo.*\bBoolean\b/);
  assert.doesNotMatch(module, /Log\.(?:i|e|d|w)\(/);
  assert.equal(packageJson.dependencies.expo, '~54.0.0');
});

test('Phase1 diagnostic never grants read, key, or migration rights based on module presence', () => {
  const inspect = read('apps/mobile/security/nativeFinanceReadiness.ts');
  assert.match(inspect, /financialStorageAllowed: false/);
  assert.match(inspect, /keyReleaseAllowed: false/);
  assert.match(inspect, /migrationAllowed: false/);
  assert.match(inspect, /native-lab-only/);
  assert.match(inspect, /Promise\.race/);
  assert.match(inspect, /Math\.min\(diagnosticTimeoutMs, 5000\)/);
});

test('Phase1 lock-file metadata inspector cannot read contents or mutate native lock state', () => {
  const probe = read(base + 'android/src/main/java/com/negresco/finance/security/NativeLockFilePresenceDiagnostic.kt');
  assert.match(probe, /negresco_native_lock\.preferences_pb/);
  assert.match(probe, /Files\.isSymbolicLink/);
  assert.match(probe, /"PRESENT_UNVERIFIED"/);
  assert.match(probe, /"ABSENT"/);
  assert.match(probe, /"UNSAFE_ENTRY"/);
  assert.match(probe, /"UNAVAILABLE"/);
  assert.match(module, /NativeLockFilePresenceDiagnostic\.inspect\(appContext\.reactContext\)/);
  assert.match(module, /"financialStorageAllowed" to false/);
  assert.match(module, /"keyReleaseAllowed" to false/);
  assert.match(module, /"migrationAllowed" to false/);
  assert.doesNotMatch(probe, /\.readBytes\(|\.writeBytes\(|FileInputStream|FileOutputStream|DataStoreFactory|PreferenceDataStoreFactory|updateData|createNewFile|delete\(|renameTo\(|\.mkdir\(|\.mkdirs\(|SqlCipher|SecretKey|BiometricPrompt/);
  assert.doesNotMatch(module, /updateData|writeBytes|unlock|enableIfCurrent|disable\(|SecretKey|Cipher\.getInstance|net\.zetetic/);
});
