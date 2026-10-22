import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = 'apps/mobile/modules/negresco-finance-security/android/src/';
const gate = read(root + 'main/java/com/negresco/finance/security/NativeLockMigrationInterruptionGate.kt');
const android = read(root + 'androidTest/java/com/negresco/finance/security/SyntheticNativeMigrationInterruptionGateTest.kt');
const bridge = read(root + 'main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');

test('migration interruption gate is only a pure classifier, never a transaction or authorization', () => {
  assert.match(gate, /internal object NativeLockMigrationInterruptionGate/);
  assert.match(gate, /fun inspect\(/);
  const executable = gate.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(executable,
    /DataStoreFactory|PreferenceDataStoreFactory|updateData|\.edit\s*\{|File\(|FileOutputStream|delete\(|remove\(|setItem\(|SharedPreferences|BiometricPrompt|CryptoObject|Cipher\.getInstance|openDatabase|createDatabase/);
  assert.doesNotMatch(executable, /return\s+"(?:ALLOW|SUCCESS|UNLOCKED|MIGRATED)/);
  assert.doesNotMatch(bridge, /NativeLockMigrationInterruptionGate|resumeMigration|commitMigration|requestUnlock/);
  for (const status of [
    'HOLD_OWNER_AUTH_REQUIRED', 'HOLD_RESUME_REQUIRES_OWNER_AUTH',
    'HOLD_BACKUP_PROOF_REQUIRED', 'HOLD_STAGED_NOT_AUTHENTICATED',
    'HOLD_SOURCE_RETIRE_REQUIRES_RECOVERY_PROOF',
    'HOLD_COMPLETED_MARKER_NOT_AUTHORITY', 'HOLD_FINALIZATION_INCOMPLETE',
    'DENY_DURABLE_INTENT_MISSING', 'DENY_TARGET_MISSING_OR_RESTORED',
    'DENY_TARGET_PREMATURE_OR_REPLAYED', 'DENY_TARGET_RECORD_UNVERIFIED',
    'DENY_UNKNOWN_JOURNAL', 'DENY_NATIVE_STORAGE_UNSAFE'
  ]) assert.ok(executable.includes('"' + status + '"'), status);
});

test('exhaustive crash matrix has 2560 combinations and does not access real files', () => {
  assert.equal((android.match(/@Test fun /g) || []).length, 8);
  assert.match(android, /exhaustiveSyntheticCrashMatrixNeverAuthorizesFinancialData/);
  assert.match(android, /assertEquals\(2560, checks\)/);
  assert.match(android, /result\.startsWith\("HOLD_"\) \|\| result\.startsWith\("DENY_"\)/);
  assert.match(android, /completedMarkerDoesNotProveOwnerOrGrantAccess/);
  assert.match(android, /restoredOlderTargetOrPrematureTargetIsRejected/);
  assert.doesNotMatch(android,
    /InstrumentationRegistry|PreferenceDataStoreFactory|SharedPreferences|File\(|updateData|BiometricPrompt|SecretKey|openDatabase/);
});
