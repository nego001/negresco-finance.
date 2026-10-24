import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const dir = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';
const fixture = read(dir + 'SyntheticJdbcCheckpointCommitGapLabTest.kt');
const runner = read(dir + 'SyntheticJdbcRekeyCasPersistenceLabTest.kt');
const policy = read(dir + 'SyntheticIndependentCheckpointGateLabTest.kt');
const mobile = read('apps/mobile/package.json');
const adr = read('docs/security/SEC_05K_ADR_EXTERNAL_MONOTONIC_CHECKPOINT_V1.md');

test('SEC-05K JDBC/checkpoint gap cannot become real authority or an app feature', () => {
  assert.match(fixture, /disposable JDBC \+ caller-asserted checkpoint NEGATIVE integration/);
  assert.match(fixture, /SyntheticJdbcRekeyCasPersistenceLab/);
  assert.match(fixture, /SyntheticIndependentCheckpointGateLab/);
  assert.match(fixture, /HOLD_EXTERNAL_ATTESTATION_AND_IMPLEMENTATION_REQUIRED/);
  assert.match(fixture, /HOLD_EXTERNAL_AUTHORITY_REQUIRED/);
  assert.match(fixture, /RandomUUID|UUID\.randomUUID\(/);
  assert.match(fixture, /no matching checkpoint, local SQL receipt or fixture proof authorizes journal/);
  assert.match(runner, /runSyntheticJdbcCheckpointCommitGapScenarios\(\)/);
  assert.doesNotMatch(mobile, /SyntheticJdbcCheckpointCommitGapLabTest|SyntheticIndependentCheckpointGateLab/);
  assert.match(policy, /proof verified.*caller-asserted/i);
  assert.match(adr, /checkpoint/);
});

test('SEC-05K both commit orderings and replay evidence stay fail-closed', () => {
  assert.match(fixture, /PostgreSQL commits NEW but its response is lost/);
  assert.match(fixture, /SQL NEW plus checkpoint OLD returns divergence/);
  assert.match(fixture, /missing checkpoint cannot complete SQL-first commit/);
  assert.match(fixture, /two matching NEW snapshots still cannot certify an atomic external commit/);
  assert.match(fixture, /claimed tree growth without verified proof holds/);
  assert.match(fixture, /cached matching checkpoint fails closed when monitor offline/);
  assert.match(fixture, /same generation and op with different ciphertext hash is denied/);
  assert.match(fixture, /OLD checkpoint replay below previously witnessed tree size denied/);
  assert.match(fixture, /split-view at same checkpoint size with different root denied/);
  assert.match(fixture, /self-reprovisioned checkpoint epoch does not pass pinned identity/);
  assert.match(fixture, /checkpoint NEW preceding SQL OLD is a held mismatch/);
  assert.match(fixture, /checkpoint claim never advances PostgreSQL or writes an SQL receipt/);
  assert.match(fixture, /eventual consistency of fixture receipts remains non-authoritative/);
});
