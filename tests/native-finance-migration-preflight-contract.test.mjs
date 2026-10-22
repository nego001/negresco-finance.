import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const main = 'apps/mobile/modules/negresco-finance-security/android/src/main/java/com/negresco/finance/security/';
const androidTest = 'apps/mobile/modules/negresco-finance-security/android/src/androidTest/java/com/negresco/finance/security/';
const gate = read(main + 'NativeLockMigrationPreflight.kt');
const fixture = read(androidTest + 'SyntheticNativeLockMigrationPreflightTest.kt');
const module = read(main + 'NegrescoFinanceSecurityV1Module.kt');
const legacy = read('apps/mobile/security/localLockPolicy.ts');

test('Legacy native lock migration is a pure hold/deny-only preflight, never a permission', () => {
  assert.match(gate, /internal object NativeLockMigrationPreflight/);
  assert.match(gate, /fun assess\(/);
  for (const marker of [
    'HOLD_UNPROVISIONED_REQUIRES_OWNER_CONFIRMATION',
    'HOLD_STRONG_NATIVE_AUTHENTICATION_REQUIRED',
    'HOLD_DISABLED_IS_NOT_AUTHENTICATED_OPTOUT',
    'HOLD_LEGACY_OPTOUT_RECOVERY',
    'HOLD_NATIVE_EXISTS_NEEDS_AUTHORITY',
    'HOLD_NATIVE_DISABLE_PENDING',
    'HOLD_LIFECYCLE_REVOKED',
    'DENY_NATIVE_STORAGE_UNSAFE',
    'DENY_NATIVE_RECORD_UNVERIFIED',
    'DENY_NATIVE_CONTRADICTORY',
    'DENY_UNKNOWN_LEGACY_JOURNAL',
    'DENY_UNKNOWN_LEGACY_PREFERENCE',
  ]) assert.ok(gate.includes('"' + marker + '"'), marker);
  assert.doesNotMatch(gate, /return\s+"(?:ALLOW|SUCCESS|UNLOCKED|MIGRATED)/);
  const executableGate = gate.split('\n').filter(line => !/^\s*(?:\/\/|\/\*|\*)/.test(line)).join('\n');
  assert.doesNotMatch(executableGate, /updateData|\.edit\s*\{|PreferenceDataStoreFactory|File\(|FileOutputStream|delete\(|remove\(|setItem\(|SharedPreferences|Keystore|Cipher\.getInstance|CryptoObject|openDatabase|createDatabase/);
  assert.doesNotMatch(module, /NativeLockMigrationPreflight|migrateLegacy|requestMigration|enableMigration|requestUnlock/);
  assert.match(legacy, /LOCAL_LOCK_PREF_KEY='negresco\.local_lock\.v1'/);
  assert.match(legacy, /LOCAL_LOCK_OPTOUT_JOURNAL_KEY='negresco\.local_lock\.optout\.v1'/);
  assert.match(legacy, /LOCAL_LOCK_DISABLE_PENDING='disable-pending'/);
});

test('Android preflight uses only synthetic arguments and covers eight fail-closed scenarios', () => {
  assert.equal((fixture.match(/@Test fun /g) || []).length, 8);
  for (const name of [
    'initialInstallNeverProvisionsOrUnlocks',
    'enabledLegacyStateRequiresStrongNativeOwnerAuthentication',
    'disabledLegacyStateIsNotAuthenticatedOptOut',
    'pendingOptOutJournalOverridesAnyLegacyPrimary',
    'oldPendingMarkerWithoutJournalStillRequiresRecovery',
    'unknownLegacyPrimaryAndJournalFailClosed',
    'existingNativeRecordIsNeverOverwrittenOrAuthenticated',
    'hostileOrContradictoryNativeStateCannotPromoteLegacyFlags'
  ]) assert.match(fixture, new RegExp(name));
  assert.match(fixture, /actual\.startsWith\("HOLD_"\) \|\| actual\.startsWith\("DENY_"\)/);
  assert.doesNotMatch(fixture, /InstrumentationRegistry|Context|DataStoreFactory|PreferenceDataStoreFactory|updateData|File\(|SharedPreferences|AsyncStorage|BiometricPrompt|SecretKey|openDatabase/);
});
