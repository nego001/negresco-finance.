import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Security Engine preflight never directly authorizes financial operations',()=>{
 const code=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SecurityOperationPolicyLab.kt');
 const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
 assert.match(code,/PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER/);
 assert.match(code,/REQUIRE_FRESH_STRONG_AUTH/);
 assert.match(code,/UNSUPPORTED_DESTRUCTIVE_OPERATION/);
 assert.match(code,/DISABLE_BIOMETRIC_LOCK/);
 assert.match(code,/DELETE_ENCRYPTION_KEYS/);
 assert.match(code,/RESTORE_ENCRYPTED_BACKUP/);
 assert.match(code,/if \(!s\.storageVerified\) return deny/);
 assert.match(code,/if \(s\.emergencyLock\) return deny/);
 assert.doesNotMatch(code,/\b(?:ALLOW|APPROVED|GRANTED)\b/);
 assert.match(runner,/runSecurityOperationPolicyScenarios\(\)/);
});

test('security decisions and 256 synthetic contexts remain Android/Expo-isolated',()=>{
 const source=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SecurityOperationPolicyLabTest.kt');
 const mobile=read('apps/mobile/package.json');
 const manifest=read('apps/mobile/app.json');
 assert.match(source,/for \(mask in 0 until 256\)/);
 assert.match(source,/runSecurityOperationPolicyScenarios/);
 assert.match(source,/Previous|previous|authorization|reauth/i);
 assert.doesNotMatch(mobile,/SecurityOperationPolicyLab|native-lock-spike/);
 assert.doesNotMatch(manifest,/SecurityOperationPolicyLab|native-lock-spike/);
});

test('safe emulator upgrade keeps one Bash process and forbids phone changes',()=>{
 const workflow=read('.github/workflows/android-upgrade-github-preflight.yml');
 const script=read('tooling/ci/android-upgrade-emulator-smoke.sh');
 assert.match(workflow,/script: bash tooling\/ci\/android-upgrade-emulator-smoke\.sh/);
 assert.match(workflow,/if: needs\.compare-published-apks\.outputs\.compatible == 'true'/);
 assert.match(script,/adb install -r "\$NEW"/);
 assert.match(script,/test "\$OLD_CERT" = "\$NEW_CERT"/);
 assert.match(script,/emulator-/);
 assert.doesNotMatch(script,/\badb\s+(?:uninstall|root|remount|reboot|push)\b|\bpm clear\b/);
});
