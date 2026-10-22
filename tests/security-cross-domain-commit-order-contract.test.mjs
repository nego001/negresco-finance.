import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';
const suite = read(root + 'SyntheticJdbcCrossDomainCommitOrderLabTest.kt');
const runner = read(root + 'SyntheticJdbcRekeyCasPersistenceLabTest.kt');
const mobile = read('apps/mobile/package.json');
const docs = read('docs/security/SEC_05K_EXTERNAL_ANCHOR_PRODUCTION_GATE_V1.md');

test('SEC-05K cross-domain ordering remains disposable and cannot grant app recovery', () => {
  assert.match(suite, /NEGATIVE JDBC integration/);
  assert.match(suite, /Randomly scoped throwaway accounts only/);
  assert.match(suite, /SyntheticProtectedAnchorFixtureLab/);
  assert.match(suite, /SyntheticJdbcRekeyCasPersistenceLab/);
  assert.match(suite, /HOLD_EXTERNAL_AUTHORITY_REQUIRED/);
  assert.match(runner, /runSyntheticJdbcCrossDomainCommitOrderScenarios\(\)/);
  assert.doesNotMatch(mobile, /SyntheticJdbcCrossDomainCommitOrderLabTest/);
  assert.match(docs, /linearizável/);
});

test('SEC-05K test covers anchor-first and SQL-first lost replies and operation conflicts', () => {
  assert.match(suite, /authority advance lost its ACK before SQL commit/);
  assert.match(suite, /SQL remains OLD without operation receipt/);
  assert.match(suite, /anchor operation ID binds exact kit and ciphertext hash/);
  assert.match(suite, /SQL can commit a DIFFERENT candidate under the same UUID/);
  assert.match(suite, /equal counters but distinct kit and hash fail closed/);
  assert.match(suite, /DENY_IDEMPOTENCY_COLLISION/);
  assert.match(suite, /DENY_COLLISION/);
  assert.match(suite, /SQL commits before losing ACK/);
  assert.match(suite, /offline anchor prevents automatic fallback/);
  assert.match(suite, /two successful receipts disagree on ciphertext/);
  assert.match(suite, /matched generations still cannot prove distributed atomic commit/);
  assert.match(suite, /matching final receipts cannot authorize local journal/);
  assert.match(suite, /no shared trusted linearizable commit/);
});
