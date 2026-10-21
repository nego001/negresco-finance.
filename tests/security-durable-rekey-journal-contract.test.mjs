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


test('SEC-05K child JVM performs independent recovery without passing secret material', () => {
  const cases = read(fixtures + 'SyntheticDurableRekeyJournalLabTest.kt');
  const runner = read(fixtures + 'NativeLockCoordinatorTest.kt');
  assert.match(runner, /fun main\(args: Array<String>\)/);
  assert.match(runner, /--sec05k-recover-fixture-only/);
  assert.match(runner, /SEC05K_CHILD_RESULT=/);
  assert.match(cases, /ProcessBuilder\(/);
  assert.match(cases, /java\.class\.path/);
  assert.match(cases, /recoverInIndependentJvm/);
  assert.match(cases, /FileChannel\.open/);
  assert.match(cases, /SyntheticJournalCheckLab\.DENY_BUSY/);
  assert.match(cases, /SyntheticJournalCheckLab\.RECOVERED_PREPARE_ROLLBACK/);
  assert.match(cases, /SyntheticJournalCheckLab\.RECOVERED_COMMIT_FINALIZED/);
  assert.match(cases, /SyntheticJournalCheckLab\.FAIL_CLOSED/);
  assert.doesNotMatch(cases, /"--sec05k-recover-fixture-only",[\s\S]{0,200}(oldSecret|newSecret|oldKey)/);
});

test('SEC-05K abrupt child JVM termination checks detached export without leaking kit secret via argv', () => {
  const cases = read(fixtures + 'SyntheticDurableRekeyJournalLabTest.kt');
  const runner = read(fixtures + 'NativeLockCoordinatorTest.kt');
  assert.match(runner, /--sec05k-commit-halt-after-marker-fixture-only/);
  assert.match(runner, /--sec05k-commit-halt-after-active-fixture-only/);
  assert.match(runner, /DataInputStream\(System\.\`in\`\)\.readFully\(secret\)/);
  assert.match(runner, /secret\.fill\(0\)/);
  assert.match(runner, /Runtime\.getRuntime\(\)\.halt\(73\)/);
  assert.match(runner, /SEC05K_CHILD_DENIED=/);
  assert.match(cases, /exportBackupFixtureOnly/);
  assert.match(cases, /channel\.force\(true\)/);
  assert.match(cases, /child\.outputStream\.use \{ it\.write\(secret\)/);
  assert.match(cases, /hardStopCommitInIndependentJvm/);
  assert.match(cases, /RECOVERED_COMMIT_FINALIZED/);
  assert.match(cases, /RECOVERED_PREPARE_ROLLBACK/);
  assert.match(cases, /secret = randomKey\(\)/);
  assert.doesNotMatch(cases, /mode, dir\.toAbsolutePath\(\)\.toString\(\), account, s\.before\.kitId,\s*(oldSecret|newSecret|oldKey)/);
});

test('SEC-05K fresh-JVM detached kit recovery checks every encrypted record without owner authority', () => {
  const code = read(kotlin + 'SyntheticDurableRekeyJournalLab.kt');
  const cases = read(fixtures + 'SyntheticDurableRekeyJournalLabTest.kt');
  const runner = read(fixtures + 'NativeLockCoordinatorTest.kt');
  assert.match(code, /VERIFIED_DETACHED_BACKUP_FIXTURE_ONLY/);
  assert.match(code, /verifyDetachedBackupAfterRestartFixtureOnly/);
  assert.match(code, /Files\.exists\(journal\) \|\| Files\.exists\(pending\)/);
  assert.match(code, /current\.records\.values\.all/);
  assert.match(code, /clear\?\.fill\(0\)/);
  assert.match(code, /dataKey\.fill\(0\)/);
  assert.match(code, /MessageDigest\.isEqual\(snapshot\.envelope, externallySuppliedEnvelope\)/);
  assert.match(runner, /--sec05k-verify-detached-fixture-only/);
  assert.match(runner, /SEC05K_DETACHED_PROOF=/);
  assert.match(runner, /readNBytes\(secret, 0, secret\.size\)/);
  assert.match(cases, /verifyDetachedInIndependentJvm/);
  assert.match(cases, /fresh third JVM decrypts every current record/);
  assert.match(cases, /wrong detached recovery secret/);
  assert.match(cases, /rollback\/stale expected generation/);
  assert.match(cases, /corrupted durable active ciphertext fails closed/);
  assert.doesNotMatch(runner, /--sec05k-verify-detached-fixture-only",[\s\S]{0,200}s\.newSecret/);
});
