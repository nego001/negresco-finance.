import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';
const fixture = read(root + 'SyntheticMerkleProofVerifierLabTest.kt');
const runner = read(root + 'NativeLockCoordinatorTest.kt');
const mobile = read('apps/mobile/package.json');
const adr = read('docs/security/SEC_05K_ADR_EXTERNAL_MONOTONIC_CHECKPOINT_V1.md');

test('SEC-05K real SHA256 Merkle proof math remains fixture-only, no production authorization', () => {
  assert.match(fixture, /RFC 9162 section 2\.1/);
  assert.match(fixture, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(fixture, /fun verifyInclusionFixtureOnly\(/);
  assert.match(fixture, /fun verifyConsistencyFixtureOnly\(/);
  assert.match(fixture, /MessageDigest\.isEqual/);
  assert.match(fixture, /HOLD_EXTERNAL_AUTHORITY_REQUIRED/);
  assert.match(fixture, /proof math has no trusted root provenance/);
  assert.match(runner, /runSyntheticMerkleProofVerifierScenarios\(\)/);
  assert.doesNotMatch(mobile, /SyntheticMerkleProofVerifierLab|runSyntheticMerkleProofVerifierScenarios/);
  assert.match(adr, /checkpoint externo/);
});

test('SEC-05K real inclusion and append-only consistency proofs reject tampering and false trust', () => {
  assert.match(fixture, /tampered inclusion sibling hash denied/);
  assert.match(fixture, /truncated inclusion path denied/);
  assert.match(fixture, /actual RFC9162 append-only consistency hash proof verifies/);
  assert.match(fixture, /missing Merkle sibling denies consistency/);
  assert.match(fixture, /mutated consistency proof denies a forged append-only claim/);
  assert.match(fixture, /swapped old\/new roots are not a consistency proof/);
  assert.match(fixture, /tree truncation denied/);
  assert.match(fixture, /same-size path denied/);
  assert.match(fixture, /split-view|rewritten history|rolled-back tree/);
  assert.match(fixture, /real SHA-256 proof math cannot identify both roots replayed OLD/);
  assert.match(fixture, /real hash-path verification is NOT trusted live authority or journal permission/);
});
