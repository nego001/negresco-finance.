import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = readFileSync('.github/workflows/guardiao-api28-debug-nav-stage-ledger-repeat.yml','utf8');
const baseline = readFileSync('.github/workflows/guardiao-api28-debug-nav-stage-ledger-android.yml','utf8');
const runner = readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const observer = readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const ledger = readFileSync('tooling/android/guardiao_api28_debug_nav_stage_ledger.py','utf8');
const home = readFileSync('tooling/android/guardiao_api28_debug_home_readiness_census_lab.py','utf8');
const policy = readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_NAV_STAGE_LEDGER_REPEAT.md','utf8');

test('M73 launches exactly two isolated API28 Debug trials, without fail-fast or retry',()=>{
 assert.match(workflow,/strategy:\s*\n\s*fail-fast: false\s*\n\s*matrix:\s*\n\s*trial: \[1, 2\]/);
 assert.match(workflow,/matrix\.trial/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/emulator-options: .*?-no-snapshot/);
 assert.equal((workflow.match(/reactivecircus\/android-emulator-runner@/g)||[]).length,1);
 assert.doesNotMatch(workflow,/assembleRelease|continue-on-error:|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
});

test('M73 workflow is byte-for-byte M72 except branch, titles, isolated concurrency and matrix',()=>{
 let expected=baseline;
 const changes=[
  ['name: Guardiao API28 Debug stage-ledger synthetic two-step preview navigation','name: Guardiao API28 Debug two independent preview navigation trials'],
  ['lab/p01-guardiao-api28-debug-nav-stage-ledger-android-v1','lab/p01-guardiao-api28-debug-nav-stage-ledger-repeat-v1'],
  ['guardiao-debug-nav-ledger-android-','guardiao-debug-nav-ledger-repeat-'],
  ['name: Stage-ledger Debug preview Home-Pix-Home (one attempt only)',"name: 'Independent bounded preview navigation trial $"+"{{ matrix.trial }}'"],
  ['    timeout-minutes: 55\n    steps:','    timeout-minutes: 55\n    strategy:\n      fail-fast: false\n      matrix:\n        trial: [1, 2]\n    steps:']
 ];
 for(const [a,b] of changes){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
 for(const x of ['contents: read','persist-credentials: false','assembleDebug','a11y-debug-observer-lab/build_observer.sh','guardiao_api28_debug_nav_preview_two_step_lab.py','sanitiz' ])
  assert.ok(workflow.includes(x),x);
});

test('each sample keeps strict Home census, PPP, two guarded actions, no repeat or extra snapshots',()=>{
 assert.match(observer,/time\.sleep\(30\.0\)/);
 assert.match(observer,/if \(idle, verdict, mask\) != \("idle-observed", "all-present", "PPP"\)/);
 assert.match(runner,/home\.passive_home_census\(\)/);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((runner.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(home,/if \(tab_status, marker_status, home_status\) != \([\s\S]*?"tabs-present-bounded", "home-marker-unique", "home-static-all"/);
 assert.match(runner,/finally:\s*\n\s*# Always delete exactly as before,[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(runner,/SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"/);
 assert.match(runner,/stable_app\(pid\)/);
 assert.doesNotMatch(runner,/"keyevent"|"swipe"|"force-stop"|\.adb\("logcat"/);
});

test('monotonic stage categories and blocker remain fixed across both trials',()=>{
 for(const x of ['pix-candidate-attested','pix-input-command-returned','pix-preview-content-attested','home-candidate-attested','home-input-command-returned','home-return-content-attested','sequence-complete'])
  assert.ok(ledger.includes(x),x);
 assert.match(ledger,/category != CHECKPOINTS\[self\._index \+ 1\]/);
 assert.match(runner,/ENV \(LAB\): debug-nav-last-checkpoint=/);
 assert.match(runner,/BLOCK \(LAB\): guarded Debug Home-Pix-Home navigation not attested/);
 assert.doesNotMatch(runner,/traceback\.print|print\(.*str\(e\)|print\(.*point\[|print\(.*bounds/);
});

test('M73 documents both-success-only and keeps P0 production gates shut',()=>{
 for(const x of ['M69','M70','M71','M72','M73','2/2','0/2','1/2','fail-fast: false','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','do not prove'])
  assert.ok(policy.toLowerCase().includes(x.toLowerCase()),x);
 assert.match(policy,/No retries/);
 assert.match(policy,/without.*Pix|does not.*Pix/i);
});
