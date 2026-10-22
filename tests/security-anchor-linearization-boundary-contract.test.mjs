import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const root = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';
const anchor = read(root + 'SyntheticProtectedAnchorBoundaryLabTest.kt');
const suite = read(root + 'SyntheticAnchorLinearizationBoundaryLabTest.kt');
const runner = read(root + 'NativeLockCoordinatorTest.kt');
const mobile = read('apps/mobile/package.json');
const docs = read('docs/security/SEC_05K_DURABLE_REKEY_JOURNAL_LAB.md');

test('SEC-05K in-JVM monitor probe is diagnostic only and does not unlock external journal', () => {
  assert.match(anchor, /fun inspectWithinJvmFenceFixtureOnly\(/);
  assert.match(anchor, /@Synchronized\s+fun inspectWithinJvmFenceFixtureOnly/);
  assert.match(anchor, /val observed = observeFixtureOnly\(/);
  assert.match(anchor, /if \(observed == SyntheticAnchorBoundaryObservationLab\.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION\)/);
  assert.match(anchor, /onDiagnosticProbeFixtureOnly\(\)/);
  assert.match(anchor, /does NOT fence an external PostgreSQL transaction/);
  assert.match(suite, /HOLD_EXTERNAL_AUTHORITY_REQUIRED/);
  assert.doesNotMatch(mobile, /inspectWithinJvmFenceFixtureOnly|SyntheticAnchorLinearizationBoundaryLabTest/);
});

test('SEC-05K stale preflight and concurrent CAS are covered by deterministic regression', () => {
  assert.match(suite, /a later CAS makes the previously correct preflight stale/);
  assert.match(suite, /diagnostic critical section rechecks live floor/);
  assert.match(suite, /same-JVM CAS cannot finish before probe leaves monitor/);
  assert.match(suite, /previously matching observation is stale immediately after next commit/);
  assert.match(suite, /wrong pin refuses fenced inspection/);
  assert.match(suite, /offline anchor cannot fall back to prior matching preflight/);
  assert.match(suite, /JVM monitor never fences a PostgreSQL or Android commit across processes/);
  assert.match(runner, /runSyntheticAnchorLinearizationBoundaryScenarios\(\)/);
  assert.match(docs, /fronteira de linearização local/i);
  assert.match(anchor, /DENY_DIAGNOSTIC_WINDOW_MUTATED/);
  assert.match(anchor, /mutationSerialFixtureOnly/);
  assert.match(anchor, /monitors are REENTRANT/i);
  assert.match(suite, /reentrant rollback and re-advance to identical bytes is rejected as ABA/);
  assert.match(suite, /normal read cannot detect erased mutation history/);
  assert.match(suite, /reentrant CAS during matching callback cannot return successful observation/);
  const jdbc = read(root + 'SyntheticJdbcLocalFenceDoesNotFencePgLabTest.kt');
  const jdbcRunner = read(root + 'SyntheticJdbcRekeyCasPersistenceLabTest.kt');
  assert.match(jdbc, /PostgreSQL CAS commits WHILE JVM anchor monitor is held/);
  assert.match(jdbc, /local monitor reports OLD while PostgreSQL has already committed NEW/);
  assert.match(jdbc, /HOLD_EXTERNAL_AUTHORITY_REQUIRED/);
  assert.match(jdbcRunner, /runSyntheticJdbcLocalFenceDoesNotFencePgScenarios\(\)/);
  assert.doesNotMatch(mobile, /SyntheticJdbcLocalFenceDoesNotFencePgLabTest/);

});
