import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const debug=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const api26=readFileSync('tooling/android/guardiao_debug_pdf_three_api26_lab.py','utf8');
const api28=readFileSync('tooling/android/guardiao_debug_pdf_ten_same_pid_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-pdf-three-api26-lab.yml','utf8');

test('API26 final Debug receipt gate is explicit, API28 remains the untouched default',()=>{
  assert.match(debug,/def run\(\*, after_verified_debug_pdf:[\s\S]*?expected_api: int = 28\)/);
  assert.match(debug,/not valid_debug_api_for_target\(report\.get\("api"\), expected_api\)/);
  assert.match(api26,/debug\.run\(expected_api=26\)/);
  assert.match(api28,/debug\.run\(\)/);
  assert.doesNotMatch(api26,/debug\.run\(\)/);
  assert.match(workflow,/lab\/p01-guardiao-debug-api26-final-gate-v1/);
  assert.match(workflow,/api-level: 26/);
  assert.match(workflow,/assembleDebug/);
  assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|secrets\.|workflow_dispatch|eas update/i);
});

test('Debug final API matching rejects cross-version, boolean and unsupported evidence without emulator',()=>{
  const py=[
   'import sys',
   "sys.path.insert(0,'tooling/android')",
   'import guardiao_pdf_debug_metro_lab as x',
   'accept=((26,26),(28,28))',
   'reject=((26,28),(28,26),(29,29),(25,25),(True,True),(False,False),("26",26),(26,"26"),(None,26),(-1,26),(26,None),(28,True),(True,28))',
   'for observed,expected in accept: assert x.valid_debug_api_for_target(observed,expected),(observed,expected)',
   'for observed,expected in reject: assert not x.valid_debug_api_for_target(observed,expected),(observed,expected)',
   'print("PASS: Debug API26 explicit target and API28 default fail-closed comparisons")'
  ].join('\n');
  const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,'strict Debug API gate regression failed');
  assert.match(result.stdout,/PASS: Debug API26 explicit target and API28 default fail-closed comparisons/);
});
