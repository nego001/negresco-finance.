import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync('.github/workflows/guardiao-api28-debug-nav-stage-ledger-android.yml','utf8');
const original=readFileSync('.github/workflows/guardiao-api28-debug-nav-preview-two-step.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const ledger=readFileSync('tooling/android/guardiao_api28_debug_nav_stage_ledger.py','utf8');
const guard=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_guard.py','utf8');
const home=readFileSync('tooling/android/guardiao_api28_debug_home_readiness_census_lab.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_NAV_STAGE_LEDGER_ANDROID.md','utf8');

test('M72 workflow is a strict copy of M69 apart from title, branch and isolation',()=>{
 let expected=original;
 const changes=[
  ['name: Guardiao API28 Debug two-step synthetic preview navigation lab','name: Guardiao API28 Debug stage-ledger synthetic two-step preview navigation'],
  ['lab/p01-guardiao-api28-debug-nav-preview-two-step-v1','lab/p01-guardiao-api28-debug-nav-stage-ledger-android-v1'],
  ['guardiao-debug-nav-preview-two-step-','guardiao-debug-nav-ledger-android-'],
  ['name: Two geometry-gated Debug preview tabs Home-Pix-Home after PPP','name: Stage-ledger Debug preview Home-Pix-Home (one attempt only)'],
  ['name: Attempt two strictly bounded preview taps after independent Home proof','name: One guarded Debug preview navigation with categorical last checkpoint']
 ];
 for(const [a,b] of changes){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
 for(const x of ['api-level: 28','-no-snapshot','assembleDebug','persist-credentials: false','contents: read','guardiao_api28_debug_nav_preview_two_step_lab.py'])
  assert.ok(workflow.includes(x),x);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
});

test('M72 retains exactly two guarded preview taps, fixed waits, no retry and XML cleanup',()=>{
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((runner.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(runner,/observer\.run\(after_verified_observation=run_two_step_navigation\)/);
 assert.match(runner,/home\.passive_home_census\(\)/);
 assert.match(home,/finally:[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(runner,/finally:\s*\n\s*# Always delete exactly as before,[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(runner,/SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"/);
 assert.match(guard,/safe_ancestor_constraint_category/);
 assert.doesNotMatch(runner,/"keyevent"|"swipe"|"pm", "clear"|"force-stop"|upload-artifact|console\.log/);
});

test('monotone ledger reports last proven category on blocked path, not raw exception',()=>{
 assert.equal((runner.match(/STAGE\.advance\(/g)||[]).length,8);
 assert.match(runner,/ENV \(LAB\): debug-nav-last-checkpoint=/);
 assert.match(runner,/print\(RESULT, file=sys\.stderr\)/);
 assert.doesNotMatch(runner,/traceback\.print|print\(.*str\(e\)|print\(.*coords|print\(.*pid|print\(.*nodes|print\(.*bounds/);
 assert.match(ledger,/category != CHECKPOINTS\[self\._index \+ 1\]/);
});

test('synthetic stage-state fixtures cannot skip, repeat or spoof checkpoints',()=>{
 const program=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'from guardiao_api28_debug_nav_stage_ledger import CHECKPOINTS,StageLedger',
  's=StageLedger()',
  "assert s.category=='preflight-pending'",
  'def rejects(v):',
  ' try: s.advance(v); return False',
  ' except RuntimeError: return True',
  "assert rejects('pix-input-command-returned')",
  "assert rejects(None)",
  "assert rejects('confidential-data')",
  'for x in CHECKPOINTS[1:]: s.advance(x)',
  "assert s.category=='sequence-complete'",
  "assert rejects('sequence-complete')",
  "print('PASS (LAB): M72 categorical stage ledger fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M72 categorical stage ledger fixtures/);
});

test('M72 preregistration does not equate input command return with UI delivery or ship a Release',()=>{
 for(const x of ['M69','M70','M71','M72','1,660/1,660','30-second','pix-input-command-returned','not','BLOCK','Draft','#120','#126','approvedForProduction=false','stableReleaseAllowed=false'])
  assert.ok(doc.includes(x),x);
 assert.match(doc,/not.*touch was delivered/i);
 assert.doesNotMatch(workflow,/push:\s*\n\s*branches:\s*\n\s*-\s*main/);
});
