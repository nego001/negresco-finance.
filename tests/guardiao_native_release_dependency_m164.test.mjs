import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('M164 dependency isolation uses actual Gradle variant graphs with fail-closed controls, only in diagnostic CI', () => {
  const s = read('tooling/android/guardiao_native_release_dependency_m164.gradle');
  const w = read('.github/workflows/ci.yml');
  assert.match(s, /project\.path != ':negresco-finance-security'/);
  assert.match(s, /\['releaseRuntimeClasspath', 'debugRuntimeClasspath'\]/);
  assert.match(s, /config\.incoming\.resolutionResult/);
  assert.match(s, /allDependencies\.any \{ it instanceof UnresolvedDependencyResult \}/);
  assert.match(s, /if \(modules\.isEmpty\(\)\)/);
  assert.match(s, /debug\.any \{ it\.group == 'net\.zetetic' && it\.module == 'sqlcipher-android' && it\.version == '4\.19\.1'/);
  assert.match(s, /debug\.any \{ it\.group == 'androidx\.biometric' && it\.module == 'biometric' && it\.version == '1\.1\.0'/);
  assert.match(s, /release\.any \{ it\.group == 'androidx\.datastore' && it\.module == 'datastore-preferences' && it\.version == '1\.2\.1'/);
  assert.match(s, /release\.any \{ it\.group == 'net\.zetetic' \|\| it\.group == 'androidx\.biometric' \}/);
  assert.doesNotMatch(s, /assembleRelease|assembleDebug|upload-artifact|doFinal\(|openDatabase\(/);
  const start = w.indexOf('  expo-native-diagnostic-compile:');
  const end = w.indexOf('  expo-native-diagnostic-emulator:');
  assert.ok(start >= 0 && end > start);
  const job = w.slice(start,end);
  assert.match(job, /- name: Verify native diagnostic Release dependency isolation \(NO APK\)\n        run: \|\n          set -euo pipefail\n          cd android\n          \.\/gradlew --no-daemon --stacktrace -I "\$GITHUB_WORKSPACE\/tooling\/android\/guardiao_native_release_dependency_m164\.gradle" :negresco-finance-security:verifyDiagnosticDependencyIsolationM164/);
  assert.equal(w.split('verifyDiagnosticDependencyIsolationM164').length, 2);
});
