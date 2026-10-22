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
  assert.match(cases, /DENY_STALE_RECEIPT_NOT_CURRENT/);
  assert.match(cases, /historical receipt cannot masquerade as latest/);
  assert.match(cases, /retainedCopy\(next\)/);
  assert.match(cases, /retainedCopy\(expected\)/);
  assert.match(cases, /caller cannot silently edit the enrolled floor/);
  assert.match(cases, /caller mutation after CAS cannot rewrite/);
  assert.match(cases, /idempotent receipt remains intact after caller-owned array mutation/);
  assert.match(cases, /DENY_RESEED/);
  assert.match(cases, /DENY_WRONG_ANCHOR_PIN/);
  assert.match(cases, /HOLD_ANCHOR_UNAVAILABLE/);
  assert.match(cases, /simultaneous PostgreSQL and signed-file rollback is detected/);
  assert.match(cases, /offline anchor never falls back to signed local state/);
  assert.match(cases, /replacement anchor cannot silently resume previous write epoch/);
  assert.match(cases, /six competing clients produce exactly one winning CAS/);
  assert.match(cases, /simulatePrivilegedFullAuthorityRollbackFixtureOnly/);
  assert.match(cases, /rewound authority accepts OLD with the UNCHANGED original pin/);
  assert.match(cases, /erased receipt permits duplicate operation after authority rewind/);
  assert.match(cases, /observations \(volatile test-double only\)/);
  assert.match(runner, /runSyntheticProtectedAnchorBoundaryScenarios\(\)/);
});

test('SEC-05K real external authority remains a blocked production gate', () => {
  assert.match(doc, /fronteira de contador externo protegido/i);
  assert.match(doc, /não é uma autoridade real/i);
  assert.match(doc, /BLOQUEADO/);
});


test('SEC-05K production authority evidence gate never promotes fixture assertions to live authority', () => {
  const code = read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticExternalAnchorAssuranceGateLabTest.kt');
  const runner = read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
  const mobile = read('apps/mobile/package.json');
  assert.match(code, /HOLD_INDEPENDENT_PRODUCTION_ATTESTATION_REQUIRED/);
  assert.match(code, /DENY_MISSING_OUT_OF_BAND_PIN/);
  assert.match(code, /DENY_IDENTITY_EPOCH_MISMATCH/);
  assert.match(code, /DENY_GENERATION_REGRESSION/);
  assert.match(code, /HOLD_NO_REPLAY_RESISTANT_STORAGE_EVIDENCE/);
  assert.match(code, /HOLD_NO_INDEPENDENT_FAILURE_DOMAIN/);
  assert.match(code, /HOLD_NO_ATOMIC_CAS_AND_RECEIPT_EVIDENCE/);
  assert.match(code, /HOLD_NO_RESTART_AND_FULL_RESTORE_TEST/);
  assert.match(code, /HOLD_NO_EXTERNAL_AUDIT_OR_RECOVERY_REVIEW/);
  assert.match(code, /HOLD_OWNER_AUTHORIZATION_UNVERIFIED/);
  assert.match(code, /HSM_SIGNING_KEY_ONLY/);
  assert.match(code, /MessageDigest\.isEqual\(nonce, echoed\)/);
  assert.match(code, /even perfect SELF-ASSERTED evidence is review-only/);
  assert.match(code, /SIGNED KEY alone|SIGNING KEY alone/);
  assert.match(code, /signed NEW does not prove that a stale response stayed latest/);
  assert.doesNotMatch(code, /return .*VERIFIED_LIVE_CURRENT/);
  assert.match(runner, /runSyntheticExternalAnchorAssuranceGateScenarios\(\)/);
  assert.doesNotMatch(mobile, /SyntheticExternalAnchorAssuranceGateLab|SyntheticExternalAnchorAssuranceInputLab/);
});
