import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_debug_same_process_nav_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-same-process-nav-lab.yml','utf8');

test('same-process navigation is isolated to ephemeral Debug API28 and never publishes',()=>{
  assert.match(workflow,/lab\/p01-guardiao-debug-same-process-nav-v1/);
  assert.match(workflow,/permissions:\s*\n  contents: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/assembleDebug/);
  assert.match(workflow,/guardiao_debug_same_process_nav_lab\.py/);
  assert.match(workflow,/api-level: 28/);
  assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|upload-artifact|contents: write|eas update|expo publish|secrets\./);
  assert.match(runner,/original_run\(\)\s+# One real PDF A/);
  assert.match(runner,/pdf_receipts != 1/);
  assert.match(runner,/debug\.run\(\)/);
  assert.match(runner,/same-process-pid-unconfirmed/);
  assert.doesNotMatch(runner,/print\(.*(?:nodes|second|first|xml|PID|fixture)|screencap|pm", "clear"|"force-stop"|input", "swipe"/i);
});

test('home touch target is rejected for thin, offscreen, duplicated or ambiguous navigation',()=>{
 const py=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_same_process_nav_lab as x',
  'names=x.TAB_IDS',
  'bounds=["[0,800][310,900]","[320,800][650,900]","[660,800][1000,900]"]',
  'nodes=[{"resource-id":"p:id/"+n,"bounds":b,"package":"p","clickable":"true","enabled":"true","selected":"false"} for n,b in zip(names,bounds)]',
  'assert x.safe_home_target(nodes,1080,960,"p")== (155,850)',
  'assert x.safe_home_target([dict(n,bounds=b) for n,b in zip(nodes,["[0,800][310,815]","[320,800][650,815]","[660,800][1000,815]"])],1080,960,"p") is None',
  'assert x.safe_home_target(nodes[:2],1080,960,"p") is None',
  'assert x.safe_home_target(nodes+[nodes[0]],1080,960,"p") is None',
  'assert x.safe_home_target([dict(nodes[0],selected="true")]+nodes[1:],1080,960,"p") is None',
  'assert x.safe_home_target([dict(nodes[0],package="wrong")]+nodes[1:],1080,960,"p") is None',
  'assert x.safe_home_target([dict(nodes[0],bounds="[0,800][310,955]")]+nodes[1:],1080,960,"p") is None',
  'assert x.safe_home_target(nodes+[{"bounds":"[10,810][300,890]","clickable":"true","enabled":"true"}],1080,960,"p") is None',
  'print("PASS: strict one-tap Debug target gate")',
 ].join('\n');
 const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: strict one-tap Debug target gate/);
});
