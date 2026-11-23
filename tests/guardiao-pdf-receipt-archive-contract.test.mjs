import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const auditor = readFileSync('tooling/android/audit_guardiao_pdf_receipt_zip.py', 'utf8');

test('offline receipt auditor rejects fraudulent ZIP shapes with synthetic fixtures', () => {
  const windows = process.platform === 'win32';
  const result = spawnSync(windows ? 'py' : 'python3', [
    ...(windows ? ['-3'] : []),
    '-m', 'unittest', 'discover', '-s', 'tooling/android',
    '-p', 'test_guardiao_pdf_receipt_zip_audit.py',
  ], {encoding: 'utf8', timeout: 30000});
  assert.equal(result.error, undefined, 'Python 3 is required for synthetic ZIP audit contracts');
  assert.equal(result.status, 0, 'Synthetic verifier tests must pass: ' + (result.stderr || result.stdout));
  assert.match(result.stderr, /Ran 10 tests/);
});

test('receipt verifier accepts only metadata with release gates disabled', () => {
  assert.match(auditor, /sourceFixture/);
  assert.match(auditor, /synthetic-48-collection-reference-invalid/);
  assert.match(auditor, /approvedForProduction/);
  assert.match(auditor, /stableReleaseAllowed/);
  assert.match(auditor, /stat\.S_IFLNK/);
  assert.match(auditor, /reject_duplicates/);
  assert.match(auditor, /set\(report\) != KEYS/);
  assert.match(auditor, /provenance must be checked independently/);
  assert.doesNotMatch(auditor, /requests\.|httpx\.|urllib\.request|print\(report\)|print\(payload\)/);
});
