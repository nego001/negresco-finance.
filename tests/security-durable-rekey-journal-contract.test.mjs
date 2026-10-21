import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const kotlin = 'tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/';
const fixtures = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';

test('SEC-05K stages encrypted records with fsync and atomic rename, not plaintext keys', () => {
  const code = read(kotlin + 'SyntheticDurableRekeyJournalLab.kt');
  assert.match(code, /channel\.force\(true\)/);
  assert.match(code, /syncDirectory\(\)/);
  assert.match(code, /StandardCopyOption\.ATOMIC_MOVE/);
  assert.match(code, /channel\.tryLock\(\)/);
  assert.match(code, /private fun encodeState/);
  assert.match(code, /SyntheticEncryptedRecordLab/);
  assert.match(code, /private fun equivalentCiphertexts/);
  assert.match(code, /MessageDigest\.isEqual\(p, q\)/);
  assert.match(code, /oldKey\.fill\(0\); newKey\.fill\(0\)/);
  assert.doesNotMatch(code, /DataOutputStream\(.*secret/i);
});

test('SEC-05K durable decision follows PREPARED and precedes replacing active snapshot', () => {
  const code = read(kotlin + 'SyntheticDurableRekeyJournalLab.kt');
  const p = code.indexOf('atomicWrite(pending, pendingBytes)');
  const prep = code.indexOf('atomicWrite(journal, encodeJournal(marker))');
  const commit = code.indexOf('SyntheticJournalPhaseLab.COMMITTED, j.account');
  const publish = code.indexOf('Files.move(pending, active');
  assert.ok(p > 0 && prep > p && commit > prep && publish > commit);
  assert.match(code, /RECOVERED_PREPARE_ROLLBACK/);
  assert.match(code, /RECOVERED_COMMIT_FINALIZED/);
  assert.match(code, /FAIL_CLOSED/);
  assert.match(code, /AFTER_COMMIT_SYNC/);
  assert.match(code, /AFTER_ACTIVE_REPLACE/);
});

test('SEC-05K JVM runner covers restart, corruption, stale replay and 2-writer race', () => {
  const cases = read(fixtures + 'SyntheticDurableRekeyJournalLabTest.kt');
  const runner = read(fixtures + 'NativeLockCoordinatorTest.kt');
  assert.match(cases, /AFTER_PENDING_SYNC/);
  assert.match(cases, /AFTER_PREPARE_SYNC/);
  assert.match(cases, /AFTER_COMMIT_SYNC/);
  assert.match(cases, /AFTER_ACTIVE_REPLACE/);
  assert.match(cases, /flipFirstByte/);
  assert.match(cases, /newFixedThreadPool\(2\)/);
  assert.match(cases, /DENY_RECOVERY_PROOF/);
  assert.match(cases, /PASS: SEC-05K/);
  assert.match(runner, /runSyntheticDurableRekeyJournalScenarios\(\)/);
});

test('SEC-05K lab and future multiagent charter stay outside the mobile runtime', () => {
  const doc = read('docs/security/SEC_05K_DURABLE_REKEY_JOURNAL_LAB.md');
  const future = read('docs/AI_MULTIAGENT_FUTURE_VISION.md');
  const roadmap = read('docs/ROADMAP.md');
  const mobile = read('apps/mobile/package.json');
  assert.match(doc, /SEC-05K/);
  assert.match(doc, /não é|NÃO É/i);
  assert.match(doc, /BLOQUEADO/);
  assert.match(doc, /backup externo/i);
  assert.match(future, /Negão/);
  assert.match(future, /Sophia/);
  assert.match(future, /Amanda/);
  assert.match(future, /Flávio/);
  assert.match(future, /Igor/);
  assert.match(future, /Michelle/);
  assert.match(future, /personalidade/);
  assert.match(roadmap, /AI_MULTIAGENT_FUTURE_VISION/);
  assert.doesNotMatch(mobile, /SyntheticDurableRekeyJournalLab/);
});
