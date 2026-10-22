import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';
const fixture = read(root + 'SyntheticMerkleInclusionProofLabTest.kt');
const runner = read(root + 'NativeLockCoordinatorTest.kt');
const app = read('apps/mobile/package.json');

test('SEC-05K Merkle inclusion uses real SHA-256 with domain separation, fixed vector and bounded paths', () => {
  assert.match(fixture, /SHA-256/);
  assert.match(fixture, /sha\(byteArrayOf\(0\) \+ data\)/);
  assert.match(fixture, /sha\(byteArrayOf\(1\) \+ left \+ right\)/);
  assert.match(fixture, /Integer\.highestOneBit\(n - 1\)/);
  assert.match(fixture, /MessageDigest\.isEqual\(computed, expectedRoot\)/);
  assert.match(fixture, /961d2e2be20f538ffdf56962a86d1bd165498f222684ee4c5e02c1e9f852adc5/);
  assert.match(fixture, /for \(size in 1\.\.13\)/);
  assert.match(fixture, /oversized proof path fails closed/);
  assert.match(fixture, /tampered root fails closed/);
  assert.match(fixture, /missing sibling fails closed/);
  assert.match(runner, /runSyntheticMerkleInclusionProofScenarios\(\)/);
  assert.doesNotMatch(app, /SyntheticMerkleInclusionProofLab/);
});

test('SEC-05K inclusion-only is not an attestation or monotonicity proof', () => {
  assert.match(fixture, /CRITICAL LIMIT: malicious issuer can fabricate root AND valid inclusion proof/);
  assert.match(fixture, /HOLD_EXTERNAL_AUTHORITY_REQUIRED/);
  assert.match(fixture, /no signed\/pinned root, consistency proof, external high-water, retention or owner/);
  assert.doesNotMatch(fixture, /return .*VERIFIED_LIVE_CURRENT/);
});
