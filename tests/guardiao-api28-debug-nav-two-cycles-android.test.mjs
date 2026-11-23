import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync('.github/workflows/guardiao-api28-debug-nav-two-cycles.yml','utf8');
const original=readFileSync('.github/workflows/guardiao-api28-debug-nav-stage-ledger-android.yml','utf8');
const two=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const one=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const observer=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const ledger=readFileSync('tooling/android/guardiao_api28_debug_nav_stage_ledger.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_NAV_TWO_CYCLES_ANDROID.md','utf8');

test('M75 is the M72 isolated Debug workflow with only names, branch and runner changed',()=>{
 const changes=[
  ['name: Guardiao API28 Debug stage-ledger synthetic two-step preview navigation','name: Guardiao API28 Debug two sequential preview navigation cycles'],
  ['lab/p01-guardiao-api28-debug-nav-stage-ledger-android-v1','lab/p01-guardiao-api28-debug-nav-two-cycles-v1'],
  ['guardiao-debug-nav-ledger-android-','guardiao-debug-nav-two-cycles-'],
  ['name: Stage-ledger Debug preview Home-Pix-Home (one attempt only)','name: Exactly two guarded preview navigation cycles in one Debug PID'],
  ['name: One guarded Debug preview navigation with categorical last checkpoint','name: Validate two sequential guarded preview cycles in one Debug process'],
  ['script: python3 tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','script: python3 tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py']
 ];
 let expected=original;
 for(const [a,b] of changes){
  assert.equal(expected.split(a).length,2,a);
  expected=expected.replace(a,b);
 }
 assert.equal(workflow,expected);
 for(const s of ['api-level: 28','-no-snapshot','assembleDebug','contents: read','persist-credentials: false','guardiao_api28_debug_nav_two_cycles_staging_lab.py','a11y-debug-observer-lab/build_observer.sh'])
  assert.ok(workflow.includes(s),s);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
});

test('two sequential cycles delegate to unchanged bounded navigation only, no bypass or retry',()=>{
 assert.match(two,/CYCLES: tuple\[str, str\] = \("first", "second"\)/);
 assert.match(two,/for label in CYCLES:/);
 assert.equal((two.match(/navigation\.run_two_step_navigation\(\)/g)||[]).length,1);
 assert.match(two,/navigation\.STAGE = StageLedger\(\)/);
 assert.match(two,/navigation\.STAGE\.category != "sequence-complete"/);
 assert.match(two,/observer\.debug_pid\(\) != baseline_pid/);
 assert.match(two,/observer\.run\(after_verified_observation=twice_same_process\)/);
 assert.doesNotMatch(two,/\.adb\(|"input"|"tap"|xml_nodes\(|getRootInActiveWindow\(|subprocess|startActivity\(|force-stop|time\.sleep\(/);
 assert.match(observer,/time\.sleep\(30\.0\)/);
 assert.match(observer,/if \(idle, verdict, mask\) != \("idle-observed", "all-present", "PPP"\)/);
 assert.equal((one.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((one.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((one.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.match(one,/home\.passive_home_census\(\)/);
 assert.match(one,/finally:\s*\n\s*# Always delete exactly as before,[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(one,/SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"/);
});

test('M75 fixed output remains categories only, not raw PID or UI',()=>{
 for(const x of ['debug-nav-active-cycle=','debug-nav-last-complete-cycle=','debug-nav-last-checkpoint=','BLOCK (LAB): two complete Debug preview nav cycles not attested','PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID'])
  assert.ok(two.includes(x),x);
 assert.match(two,/if checkpoint not in CHECKPOINTS/);
 assert.match(ledger,/category != CHECKPOINTS\[self\._index \+ 1\]/);
 assert.doesNotMatch(two,/print\(\s*str\(e\)|traceback\.print|print\([^)]*\+\s*(?:pid|point|nodes|bounds)\b/);
});

test('pure M75 fixture rejects second-cycle error without allowing a third attempt',()=>{
 const py=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_nav_two_cycles_staging_lab as m',
  'from guardiao_api28_debug_nav_stage_ledger import CHECKPOINTS',
  "m.observer.debug_pid=lambda:'pid-stable'",
  'm.observer.debug_focus=lambda:True',
  'calls=[]',
  'def first_and_second():',
  ' calls.append(m.ACTIVE)',
  ' for stage in CHECKPOINTS[1:]: m.navigation.STAGE.advance(stage)',
  'm.navigation.run_two_step_navigation=first_and_second',
  'm.twice_same_process()',
  "assert calls==['first','second'] and m.LAST_COMPLETE=='second'",
  "m.ACTIVE='not-started';m.LAST_COMPLETE='none';calls.clear()",
  'def second_fails():',
  ' calls.append(m.ACTIVE)',
  " if len(calls)==2: raise RuntimeError('no raw leak')",
  ' for stage in CHECKPOINTS[1:]: m.navigation.STAGE.advance(stage)',
  'm.navigation.run_two_step_navigation=second_fails',
  'try:',
  ' m.twice_same_process()',
  " raise AssertionError('unexpected PASS')",
  'except RuntimeError: pass',
  "assert calls==['first','second'] and m.ACTIVE=='second' and m.LAST_COMPLETE=='first'",
  "print('PASS (LAB): M75 sequential two-cycle pure fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M75 sequential two-cycle pure fixtures/);
});

test('documentation distinguishes Debug preview from historical Release PDF P0',()=>{
 for(const x of ['M73','M74','M75','1670/1670','30-second','four','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','not','PDF'])
  assert.ok(policy.toLowerCase().includes(x.toLowerCase()),x);
 assert.match(policy,/two synthetic PDF cycles/i);
 assert.match(policy,/No production signing/i);
});
