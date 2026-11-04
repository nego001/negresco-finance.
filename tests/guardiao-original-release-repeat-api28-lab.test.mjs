import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync('.github/workflows/guardiao-original-release-repeat-api28-lab.yml','utf8');
const verifier=readFileSync('tooling/android/verify_original_release_repeat_receipts.py','utf8');

test('Release repetitions use fixed SHA, three independent API28 jobs, strict receipts',()=>{
 assert.match(workflow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
 assert.match(workflow,/sha256sum --check --strict/);
 assert.match(workflow,/negresco-finance-v313-security-preview/);
 assert.match(workflow,/Negresco-Finance-V3\.1\.3-preview\.apk/);
 assert.match(workflow,/install -D -m 0600 test-apk\/Negresco-Finance-V3\.1\.3-preview\.apk test-apk\/android\/app\/build\/outputs\/apk\/release\/app-release\.apk/);
 assert.match(workflow,/test ! -L test-apk\/Negresco-Finance-V3\.1\.3-preview\.apk/);
 assert.doesNotMatch(workflow,/name: negresco-finance-v313-test-apk/);

 assert.match(workflow,/api: 26\s*\n\s*sample: control/);
 for(const label of ['a','b','c'])assert.match(workflow,new RegExp('api: 28\\s*\\n\\s*sample: '+label));
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/python3 tooling\/android\/guardiao_original_release_input_replay_lab\.py/);
 assert.match(workflow,/python3 tooling\/android\/verify_original_release_repeat_receipts\.py receipt-pair/);
 assert.match(workflow,/if-no-files-found: error/);
 assert.match(workflow,/needs: android-real-pdf-text/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-apk|eas update|workflow_dispatch|secrets\./i);
 assert.match(verifier,/read_member_at\(folder_fd\)/);
 assert.match(verifier,/receipt\.verify\(parsed, api\)/);
 assert.match(verifier,/receipt\.open_no_symlink_path\(root, DIR_FLAGS\)/);
});

test('sample receipt audit rejects missing, swapped, extra and symlinked members',()=>{
 const code=[
  'import sys,json,tempfile,pathlib',
  "sys.path.insert(0,'tooling/android')",
  'import verify_original_release_repeat_receipts as v',
  'import verify_collection48_receipt as r',
  'with tempfile.TemporaryDirectory() as tmp:',
  '  root=pathlib.Path(tmp)/"receipts"',
  '  root.mkdir()',
  '  def fixture(api):',
  '    x={k:True for k in r.TRUE_FLAGS}',
  '    x.update({k:False for k in r.FALSE_FLAGS})',
  '    x.update({"api":api,"apkSha256":r.APK_SHA,"scope":r.SCOPE,"sourceFixture":r.FIXTURE,"schemaVersion":2,"pdfPageCount":1,"pdfPages":1,"nonblankPages":1,"textPagesVerified":1,"pdfSizeBytes":2048,"receivedPdfSha256":"a"*64})',
  '    return x',
  '  for api,sample in v.SAMPLES:',
  '    p=root/(v.PREFIX+str(api)+"-repeat-"+sample+v.SUFFIX)',
  '    p.mkdir()',
  '    (p/r.MEMBER).write_text(json.dumps(fixture(api)))',
  '  v.verify_repetition(root)',
  '  target=root/(v.PREFIX+"28-repeat-a"+v.SUFFIX)/r.MEMBER',
  '  target.unlink()',
  '  try: v.verify_repetition(root)',
  '  except Exception: pass',
  '  else: raise AssertionError("missing receipt accepted")',
  '  target.write_text(json.dumps(fixture(26)))',
  '  try: v.verify_repetition(root)',
  '  except Exception: pass',
  '  else: raise AssertionError("swapped API accepted")',
  '  target.write_text(json.dumps(fixture(28)))',
  '  extra=root/"extra"',
  '  extra.mkdir()',
  '  try: v.verify_repetition(root)',
  '  except Exception: pass',
  '  else: raise AssertionError("extra directory accepted")',
  '  extra.rmdir()',
  '  target.unlink()',
  '  target.symlink_to(root/(v.PREFIX+"26-repeat-control"+v.SUFFIX)/r.MEMBER)',
  '  try: v.verify_repetition(root)',
  '  except Exception: pass',
  '  else: raise AssertionError("symlink accepted")',
  'print("PASS: four release receipt slots fail closed")',
 ].join('\n');
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: four release receipt slots fail closed');
});
