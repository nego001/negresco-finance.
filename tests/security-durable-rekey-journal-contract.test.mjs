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
  assert.match(code, /existsNoFollow\(journal\) \|\| existsNoFollow\(pending\)/);
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

test('SEC-05K filesystem fixture refuses symlink and dangling aliases without following them', () => {
  const code = read(kotlin + 'SyntheticDurableRekeyJournalLab.kt');
  const cases = read(fixtures + 'SyntheticDurableRekeyJournalLabTest.kt');
  assert.match(code, /LinkOption\.NOFOLLOW_LINKS/);
  assert.match(code, /Files\.isSymbolicLink\(directory\)/);
  assert.match(code, /listOf\(active, pending, journal, lockPath, provisioned\)\.none\(Files::isSymbolicLink\)/);
  assert.match(code, /private fun existsNoFollow/);
  assert.match(code, /Files\.isRegularFile\(path, LinkOption\.NOFOLLOW_LINKS\)/);
  assert.match(cases, /Files\.createSymbolicLink\(dir\.resolve\("active\.snapshot"\)/);
  assert.match(cases, /Files\.createSymbolicLink\(dir\.resolve\("pending\.snapshot"\)/);
  assert.match(cases, /Files\.createSymbolicLink\(dir\.resolve\("migration\.journal"\)/);
  assert.match(cases, /Files\.createSymbolicLink\(dir\.resolve\("migration\.lock"\)/);
  assert.match(cases, /Files\.createSymbolicLink\(alias, dir\)/);
  assert.match(cases, /Files\.createSymbolicLink\(dangling,/);
  assert.match(cases, /symlinked fixture root directory cannot be trusted/);
  assert.match(cases, /dangling pending alias is not misclassified/);
});

test('SEC-05K journal cleanup requires post-publish readback and descriptor-bound nofollow reads', () => {
  const code = read(kotlin + 'SyntheticDurableRekeyJournalLab.kt');
  const cases = read(fixtures + 'SyntheticDurableRekeyJournalLabTest.kt');
  assert.match(code, /FileChannel\.open\(path, StandardOpenOption\.READ, LinkOption\.NOFOLLOW_LINKS\)/);
  assert.match(code, /val size = channel\.size\(\)/);
  assert.match(code, /require\(channel\.size\(\) == size\)/);
  assert.match(code, /TAMPER_PENDING_BEFORE_PUBLISH_FIXTURE_ONLY/);
  assert.match(code, /TAMPER_ACTIVE_AFTER_PUBLISH_FIXTURE_ONLY/);
  assert.match(code, /tamperFirstByteFixtureOnly\(pending\)/);
  assert.match(code, /tamperFirstByteFixtureOnly\(active\)/);
  const commit = code.slice(code.indexOf('fun commitFixtureOnly('), code.indexOf('fun recoverFixtureOnly()'));
  const move = commit.indexOf('Files.move(pending, active');
  const attested = commit.indexOf('if (!same(readBytes(active), j.newHash))');
  const cleanup = commit.lastIndexOf('remove(journal)');
  assert.ok(move >= 0 && attested > move && cleanup > attested);
  const recovery = code.slice(code.indexOf('fun recoverFixtureOnly()'), code.indexOf('fun verifyDetachedBackupAfterRestartFixtureOnly('));
  const recoverMove = recovery.lastIndexOf('Files.move(pending, active');
  const recoverAttested = recovery.lastIndexOf('if (!same(readBytes(active), j.newHash))');
  const recoverCleanup = recovery.lastIndexOf('remove(journal)');
  assert.ok(recoverMove >= 0 && recoverAttested > recoverMove && recoverCleanup > recoverAttested);
  assert.match(cases, /tamper after durable commit decision is rejected/);
  assert.match(cases, /post-promotion corruption is detected/);
  assert.match(cases, /COMMITTED journal remains/);
});

test('SEC-05K ignores advisory lock in restricted child fixture yet never clears unverified COMMITTED journal', () => {
  const code = read(kotlin + 'SyntheticDurableRekeyJournalLab.kt');
  const cases = read(fixtures + 'SyntheticDurableRekeyJournalLabTest.kt');
  const runner = read(fixtures + 'NativeLockCoordinatorTest.kt');
  assert.match(code, /TAMPER_PENDING_AFTER_FINAL_CHECK_FIXTURE_ONLY/);
  assert.match(code, /tamperFirstByteFixtureOnly\(pending\)/);
  assert.match(cases, /mutation after last pre-move checksum fails post-publish attestation/);
  assert.match(cases, /mutatePendingWithoutLockInIndependentJvm/);
  assert.match(cases, /COMMITTED marker retained after a corrupted candidate was promoted/);
  assert.match(cases, /PREPARED rollback discards concurrently tampered candidate/);
  assert.match(cases, /COMMITTED recovery rejects candidate corrupted by JVM ignoring lock/);
  assert.match(runner, /--sec05k-noncooperative-candidate-fixture-only/);
  assert.match(runner, /dir\.fileName\.toString\(\)\.startsWith\("negresco-sec05k-disposable-"\)/);
  assert.match(runner, /SEC05K_NONCOOPERATIVE_CANDIDATE_MUTATED=FIXTURE_ONLY/);
});

test('SEC-05K provision guard and bounded malformed storage prevent silent reprovision', () => {
  const code = read(kotlin + 'SyntheticDurableRekeyJournalLab.kt');
  const cases = read(fixtures + 'SyntheticDurableRekeyJournalLabTest.kt');
  assert.match(code, /provisioned = directory\.resolve\("provisioned\.guard"\)/);
  assert.match(code, /private fun provisionedBytes\(\)/);
  assert.match(code, /atomicWrite\(provisioned, provisionedBytes\(\)\)/);
  assert.match(code, /existsNoFollow\(provisioned\)/);
  assert.match(code, /readBytes\(provisioned\)/);
  assert.match(code, /MessageDigest\.isEqual\(/);
  const seed = code.slice(code.indexOf('fun seedFixtureOnly('), code.indexOf('fun prepareFixtureOnly('));
  assert.ok(seed.indexOf('atomicWrite(provisioned, provisionedBytes())') <
    seed.indexOf('atomicWrite(active, encodeState(state))'));
  assert.match(cases, /missing active with durable provision marker is denied re-provision/);
  assert.match(cases, /corrupted provision marker prevents normal recovery/);
  assert.match(cases, /absent provision marker with surviving active is not trusted/);
  assert.match(cases, /invalid active file size \$size fails closed/);
  assert.match(cases, /COMMITTED candidate malformed size \$size must fail closed/);
  assert.match(cases, /malformed journal size \$size does not guess/);
  assert.match(cases, /missing COMMITTED pending cannot silently restore old active generation/);
});

test('SEC-05K detached signed generation witness detects local rollback but documents signed-pair replay', () => {
  const code = read(kotlin + 'SyntheticDetachedGenerationWitnessLab.kt');
  const cases = read(fixtures + 'SyntheticDurableRekeyJournalLabTest.kt');
  const mobile = read('apps/mobile/package.json');
  assert.match(code, /Mac\.getInstance\("HmacSHA256"\)/);
  assert.match(code, /macDomain/);
  assert.match(code, /MessageDigest\.isEqual/);
  assert.match(code, /LinkOption\.NOFOLLOW_LINKS/);
  assert.match(code, /StandardCopyOption\.ATOMIC_MOVE/);
  assert.match(code, /channel\.force\(true\)/);
  assert.match(code, /bootstrapFixtureOnly/);
  assert.match(code, /advanceFixtureOnly/);
  assert.match(code, /verifyFixtureOnly/);
  assert.match(code, /after\.generation != expectedBefore\.generation \+ 1/);
  assert.match(code, /detachedMacKey\.size != 32/);
  assert.match(cases, /replayed old ciphertext is detected by independently retained witness/);
  assert.match(cases, /external witness detects locally reseeded state after paired file wipe/);
  assert.match(cases, /tampered signed generation receipt fails HMAC verification/);
  assert.match(cases, /loss of detached receipt must fail closed/);
  assert.match(cases, /known limitation: replaying BOTH signed witness and old ciphertext remains possible/);
  assert.match(cases, /external witness cannot be stored inside local journal directory/);
  assert.doesNotMatch(mobile, /SyntheticDetachedGenerationWitnessLab/);
});

test('SEC-05K reconciliation requires genuinely fresh pinned authority and never treats HMAC witness as live monotonic authority', () => {
  const code = read(kotlin + 'SyntheticJournalAuthorityReconciliationPolicyLab.kt');
  const cases = read(fixtures + 'SyntheticJournalAuthorityReconciliationPolicyLabTest.kt');
  const runner = read(fixtures + 'NativeLockCoordinatorTest.kt');
  const mobile = read('apps/mobile/package.json');
  assert.match(code, /VERIFIED_LIVE_CURRENT/);
  assert.match(code, /REPLAYABLE_DETACHED_HMAC_ONLY/);
  assert.match(code, /MISSING_OR_OFFLINE/);
  assert.match(code, /INVALID_OR_STALE/);
  assert.match(code, /MAY_DISCARD_PREPARED_CANDIDATE_ONLY/);
  assert.match(code, /MAY_FINALIZE_COMMITTED_NEW_SNAPSHOT_ONLY/);
  assert.match(code, /MAY_CLEAR_COMMITTED_MARKER_ONLY/);
  assert.match(code, /HOLD_EXTERNAL_AUTHORITY_REQUIRED/);
  assert.match(code, /input\.authorityEvidence != SyntheticRekeyAuthorityEvidenceLab\.VERIFIED_LIVE_CURRENT/);
  assert.match(code, /input\.newGeneration != input\.oldGeneration \+ 1L/);
  assert.match(code, /input\.newVersion != input\.oldVersion \+ 1L/);
  assert.match(cases, /replaying old advance request|already-published NEW with OLD authority|COMMITTED local with authority still OLD/);
  assert.match(cases, /runSyntheticJournalAuthorityReconciliationPolicyScenarios/);
  assert.match(runner, /runSyntheticJournalAuthorityReconciliationPolicyScenarios/);
  assert.doesNotMatch(mobile, /SyntheticJournalAuthorityReconciliationPolicyLab/);
});
