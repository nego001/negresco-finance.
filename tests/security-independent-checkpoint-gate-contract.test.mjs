import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const root = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';
const fixture = read(root + 'SyntheticIndependentCheckpointGateLabTest.kt');
const runner = read(root + 'NativeLockCoordinatorTest.kt');
const adr = read('docs/security/SEC_05K_ADR_EXTERNAL_MONOTONIC_CHECKPOINT_V1.md');
const mobile = read('apps/mobile/package.json');

test('SEC-05K independent checkpoint is a synthetic negative gate, never a live authorization', () => {
  assert.match(fixture, /PURE JVM checkpoint-consistency NEGATIVE TEST/);
  assert.match(fixture, /HOLD_EXTERNAL_ATTESTATION_AND_IMPLEMENTATION_REQUIRED/);
  assert.match(fixture, /HOLD_INCOMPLETE_TWO_DOMAIN_COMMIT/);
  assert.match(fixture, /DENY_OPERATION_COLLISION/);
  assert.match(fixture, /DENY_ROLLBACK_FROM_HIGH_WATER/);
  assert.match(fixture, /DENY_TREE_TRUNCATION/);
  assert.match(fixture, /DENY_EQUIVOCATION_SAME_TREE_SIZE/);
  assert.match(fixture, /HOLD_NO_CONSISTENCY_PROOF/);
  assert.match(fixture, /HOLD_NO_INDEPENDENT_ADMIN_OR_RETENTION/);
  assert.match(fixture, /HOLD_OWNER_NOT_VERIFIED/);
  assert.match(fixture, /alleged consistency proof still cannot produce permission/);
  assert.match(fixture, /multiple independent faults stay visible without bypass/);
  assert.match(runner, /runSyntheticIndependentCheckpointGateScenarios\(\)/);
  assert.doesNotMatch(mobile, /SyntheticIndependentCheckpointGateLab|SyntheticCheckpointGateInputLab/);
});

test('SEC-05K ADR forbids provider-name-as-proof and preserves production blocking', () => {
  assert.match(adr, /PROPOSTA PARA REVISÃO/);
  assert.match(adr, /outro conjunto de credenciais/);
  assert.match(adr, /truncamento ou split-view/);
  assert.match(adr, /S3 Object Lock/);
  assert.match(adr, /RFC 9162/);
  assert.match(adr, /Nenhuma opção está contratada, configurada ou auditada/);
  assert.match(adr, /Não publicar SQLCipher\/journal/);
  assert.match(adr, /HOLD_EXTERNAL_AUTHORITY_REQUIRED/);
  assert.match(adr, /PR #14 permanece draft/);
});
