import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const base = 'apps/mobile/modules/negresco-finance-security/android/';
const ledger = get(base+'src/debug/java/com/negresco/finance/security/SyntheticDebugQaCleanupLedger.kt');
const android = get(base+'src/androidTest/java/com/negresco/finance/security/SyntheticDebugQaCleanupLedgerTest.kt');
const activity = get(base+'src/debug/java/com/negresco/finance/security/SyntheticBiometricSqlcipherManualQaActivity.kt');
const expo = get(base+'src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt');
const release = get(base+'src/main/AndroidManifest.xml');

test('Debug QA Activity delegates live cleanup and keeps failed residue identities', () => {
  assert.match(activity, /SyntheticDebugQaCleanupLedger\.cleanup\(/);
  assert.match(activity, /alias = residue\.alias/);
  assert.match(activity, /root = residue\.directory/);
  assert.match(activity, /return residue\.complete/);
  assert.match(activity, /if \(!cleanup\(\)\)/);
  assert.match(ledger, /catch \(_: Exception\) \{ false \}/);
  assert.match(ledger, /complete = aliasLeft == null && directoryLeft == null/);
  assert.doesNotMatch(expo, /SyntheticDebugQaCleanupLedger/);
  assert.doesNotMatch(release, /SyntheticDebugQaCleanupLedger/);
});

test('four Android tests inject alias and directory failure, retry, and thrown error', () => {
  const found = [...android.matchAll(/@Test fun ([A-Za-z0-9_]+)\s*\(/g)].map(m => m[1]);
  assert.deepEqual(found, [
    'failingAliasRevocationRetainsAliasAndBlocksCleanState',
    'failingDirectoryDeletionRetainsPathAndBlocksCleanState',
    'retryCannotReportCleanUntilAllResiduesAreRemoved',
    'thrownRevocationAndDeletionCannotBeMisreportedAsPass'
  ]);
  assert.match(android, /deleteAlias = \{ false \}/);
  assert.match(android, /deleteDirectory = \{ false \}/);
  assert.match(android, /synthetic alias deletion fault/);
  assert.match(android, /synthetic directory deletion fault/);
});
