import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner = readFileSync('tooling/android/guardiao_original_release_input_replay_lab.py','utf8');
const workflow = readFileSync('.github/workflows/guardiao-original-release-paired-replay-lab.yml','utf8');

test('only unique actual accessible EditText qualifies for immutable Release replay', () => {
 const code=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_original_release_input_replay_lab as p',
  'fixture="8"+"0"*47',
  'label={"class":"android.widget.TextView","text":"Linha digitável do boleto"}',
  'field={"class":"android.widget.EditText","content-desc":p.LABEL,"text":fixture,"bounds":"[1,1][100,100]"}',
  'assert p.choose_unique_input([label,field],verify_value=False) is field',
  'assert p.choose_unique_input([label,field],verify_value=True) is field',
  'for nodes, category in [([label],"synthetic-edittext-not-observed"),([field,dict(field)],"synthetic-edittext-ambiguous"),([dict(field,text="")],"synthetic-edittext-value-unconfirmed")]:',
  '  try: p.choose_unique_input(nodes,verify_value=True)',
  '  except ValueError as exc: assert str(exc)==category',
  '  else: raise AssertionError("weak synthetic EditText accepted")',
  'print("PASS: exact-field uniqueness and synthetic value required")'
 ].join('\n');
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: exact-field uniqueness and synthetic value required');
});

test('Release replay never changes SHA-pinned APK, publication or gate requirements',()=>{
 assert.match(workflow,/lab\/p01-guardiao-debug-metro-phase-v1/);
 assert.match(workflow,/matrix:\s*\n\s*api: \[26, 28\]/);
 assert.match(workflow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
 assert.match(workflow,/sha256sum --check --strict/);
 assert.match(workflow,/negresco-finance-v313-security-preview/);
 assert.match(workflow,/Negresco-Finance-V3\.1\.3-preview\.apk/);
 assert.match(workflow,/install -D -m 0600 test-apk\/Negresco-Finance-V3\.1\.3-preview\.apk test-apk\/android\/app\/build\/outputs\/apk\/release\/app-release\.apk/);
 assert.match(workflow,/test ! -L test-apk\/Negresco-Finance-V3\.1\.3-preview\.apk/);
 assert.doesNotMatch(workflow,/name: negresco-finance-v313-test-apk/);

 assert.match(workflow,/python3 tooling\/android\/guardiao_original_release_input_replay_lab\.py/);
 assert.match(workflow,/python3 tooling\/android\/verify_collection48_receipt_pair\.py receipt-pair/);
 assert.match(workflow,/path: guardiao-android-real-pdf-text-receipt\.json/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-apk|eas update|workflow_dispatch/);
 assert.match(runner,/base\.wait_visible = original_wait_visible/);
 assert.match(runner,/lab\.run_lab\(\)/);
 assert.match(runner,/choose_unique_input\(base\.xml_nodes\(\), verify_value=\(retries == 10\)\)/);
 assert.doesNotMatch(runner,/print\([^\n]*(?:get\("text"\)|FIXTURE|xml_nodes\(\))|upload_artifact|https?:\/\//);
});
