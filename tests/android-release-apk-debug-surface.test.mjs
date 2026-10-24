import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../tooling/android/verify_release_apk_surface.py', import.meta.url));
const workflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const clean = {
  'classes.dex': 'Lcom/negresco/finance/security/NegrescoFinanceSecurityV1Module;',
  'AndroidManifest.xml': '<manifest package="com.negresco.finance"/>',
};
function check(entries) {
  const dir = mkdtempSync(join(tmpdir(), 'negresco-release-gate-'));
  const apk = join(dir, 'test.apk');
  try {
    const made = spawnSync('python3', [
      '-c',
      'import json,sys,zipfile;z=zipfile.ZipFile(sys.argv[1],"w");' +
        '[z.writestr(k,v) for k,v in json.loads(sys.argv[2]).items()];z.close()',
      apk, JSON.stringify(entries)
    ], {encoding:'utf8'});
    assert.equal(made.status, 0, made.stderr);
    return spawnSync('python3', [script, apk], {encoding:'utf8'});
  } finally {
    rmSync(dir, {force:true, recursive:true});
  }
}
test('release APK workflow runs the packaging guard on the assembled artifact', () => {
  assert.match(workflow, /Verify APK structure and signature/);
  assert.match(workflow, /python3 \.\.\/\.\.\/tooling\/android\/verify_release_apk_surface\.py "\$APK"/);
  assert.match(workflow, /publish_release/);
  assert.match(workflow, /workflow_dispatch/);
});
test('synthetic clean candidate passes read-only surface inspection', () => {
  const result = check(clean);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS: assembled Release APK/);
});
test('biometric QA Activity in secondary DEX blocks candidate', () => {
  const result = check({...clean,
    'classes2.dex': 'Lcom/negresco/finance/security/SyntheticBiometricSqlcipherManualQaActivity;'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SEC05 BLOCK.*SyntheticBiometricSqlcipherManualQaActivity/);
});
test('orphan inspector in manifest blocks candidate', () => {
  const result = check({...clean,'AndroidManifest.xml':'SyntheticDebugQaOrphanInspection'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SyntheticDebugQaOrphanInspection/);
});
test('Debug cleanup helper in compiled resources blocks candidate', () => {
  const result = check({...clean,'resources.arsc':'SyntheticDebugQaCleanupLedger'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SyntheticDebugQaCleanupLedger/);
});
test('missing DEX and missing Android manifest both fail closed', () => {
  assert.equal(check({'AndroidManifest.xml':'<manifest/>'}).status, 1);
  assert.equal(check({'classes.dex':'Lcom/negresco/finance/App;'}).status, 1);
});
