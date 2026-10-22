import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const cases = read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticProtectedAnchorBoundaryLabTest.kt');
const runner = read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
const mobile = read('apps/mobile/package.json');
const doc = read('docs/security/SEC_05K_DURABLE_REKEY_JOURNAL_LAB.md');

test('SEC-05K anchor boundary is a volatile fixture, never a cryptographic or banking authority', () => {
  assert.match(cases, /NEVER A REAL ANTI-ROLLBACK AUTHORITY/);
  assert.match(cases, /The register and its receipts disappear/);
  assert.match(cases, /never map it to VERIFIED_LIVE_CURRENT/i);
  assert.match(cases, /private val floors = mutableMapOf/);
  assert.match(cases, /private val receipts =/);
  assert.doesNotMatch(cases, /DriverManager\.getConnection\(|jdbc:postgresql:|KeyStore\.getInstance\(|ServerSocket\(/);
  assert.doesNotMatch(mobile, /SyntheticProtectedAnchorFixtureLab|SyntheticProtectedAnchorBoundaryLabTest/);
});

test('SEC-05K explicit fail-closed matrix covers rollback, lost ACK, concurrent CAS and false restart assurances', () => {
  assert.match(cases, /LOST_REPLY_AFTER_ADVANCE/);
  assert.match(cases, /ALREADY_APPLIED_FIXTURE_ONLY/);
  assert.match(cases, /DENY_COLLISION/);
  assert.match(cases, /DENY_RESEED/);
  assert.match(cases, /DENY_WRONG_ANCHOR_PIN/);
  assert.match(cases, /HOLD_ANCHOR_UNAVAILABLE/);
  assert.match(cases, /simultaneous PostgreSQL and signed-file rollback is detected/);
  assert.match(cases, /offline anchor never falls back to signed local state/);
  assert.match(cases, /replacement anchor cannot silently resume previous write epoch/);
  assert.match(cases, /six competing clients produce exactly one winning CAS/);
  assert.match(cases, /observations \(volatile test-double only\)/);
  assert.match(runner, /runSyntheticProtectedAnchorBoundaryScenarios\(\)/);
});

test('SEC-05K real external authority remains a blocked production gate', () => {
  assert.match(doc, /fronteira de contador externo protegido/i);
  assert.match(doc, /não é uma autoridade real/i);
  assert.match(doc, /BLOQUEADO/);
});
