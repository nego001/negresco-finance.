import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/guardiao-api28-debug-startup-settle-30s-repeat.yml','utf8');
const baseline=readFileSync('.github/workflows/guardiao-api28-debug-startup-settle-30s.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const observer=readFileSync('tooling/android/a11y-debug-observer-lab/app/src/main/java/com/negresco/a11ydebugobserver/lab/ObserveInstrumentation.java','utf8');
const home=readFileSync('tooling/android/guardiao_api28_debug_home_readiness_census_lab.py','utf8');
const triage=readFileSync('tooling/android/guardiao_api28_debug_native_transport_triage_lab.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_STARTUP_SETTLE_30S_REPEAT.md','utf8');

test('M67 preregisters exactly two independent API28 emulator trials and does not hide failure',()=>{
 assert.match(workflow,/trial: \[1, 2\]/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/Independent 30s Debug Home trial \$\{\{ matrix\.trial \}\}/);
 assert.equal((workflow.match(/reactivecircus\/android-emulator-runner@/g)||[]).length,1);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/emulator-options: .*?-no-snapshot/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_api28_debug_native_transport_triage_lab\.py/);
 assert.doesNotMatch(workflow,/retry|continue-on-error:|workflow_dispatch:|schedule:|pull_request:|assembleRelease|upload-artifact|download-artifact|contents: write|secrets\./);
});

test('M67 workflow matches the M66 workflow except branch, titles, isolation and matrix',()=>{
 let expected=baseline;
 const changes=[
   ['name: Guardiao API28 Debug isolated 30s first-read startup settling study','name: Guardiao API28 Debug independent 30s Home readiness repeat (readonly)'],
   ['lab/p01-guardiao-api28-debug-startup-settle-30s-v1','lab/p01-guardiao-api28-debug-startup-settle-30s-repeat-v1'],
   ['guardiao-debug-settle-30s-','guardiao-debug-settle-30s-repeat-'],
   ['    name: Predeclared 30s startup delay then one Debug PPP/Home census',"    name: 'Independent 30s Debug Home trial $"+"{{ matrix.trial }}'"],
   ['    timeout-minutes: 55\n    steps:','    timeout-minutes: 55\n    strategy:\n      fail-fast: false\n      matrix:\n        trial: [1, 2]\n    steps:']
 ];
 for(const [a,b] of changes){
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(workflow,expected);
 for(const value of ['persist-credentials: false','contents: read','assembleDebug','sanitize_guardiao_debug_manifest.py','guardiao_debug_loopback_policy.py','a11y-debug-observer-lab/build_observer.sh'])
   assert.ok(workflow.includes(value),value);
});

test('same fixed 30s observer retains strict PPP, stable PID and prohibits gestures',()=>{
 assert.equal((runner.match(/time\.sleep\(30\.0\)/g)||[]).length,1);
 assert.equal((runner.match(/"monkey"/g)||[]).length,1);
 assert.equal((runner.match(/"instrument"/g)||[]).length,1);
 assert.doesNotMatch(runner,/time\.sleep\(5\.0\)|input", "tap|input", "swipe|input", "keyevent|retry_after/);
 const settle=runner.indexOf('time.sleep(30.0)');
 const pid=runner.indexOf('before_pid = debug_pid()');
 const gate=runner.indexOf('if (idle, verdict, mask) != ("idle-observed", "all-present", "PPP")');
 const callback=runner.indexOf('after_verified_observation()');
 assert.ok(settle>0 && pid>settle && gate>pid && callback>gate);
 assert.equal((observer.match(/getRootInActiveWindow\(\)/g)||[]).length,1);
 assert.equal((observer.match(/waitForIdle\(1000L, 5000L\)/g)||[]).length,1);
 assert.match(observer,/for \(int i = 1; i <= 3; i\+\+\)/);
 assert.doesNotMatch(observer,/getText\(|getContentDescription\(|getBoundsInScreen\(|getChild\(|takeScreenshot|injectInputEvent|performAction|startActivity/);
});

test('single Home snapshot remains fail-closed with geometry and XML deletion',()=>{
 assert.match(triage,/home\.passive_home_census\(\)/);
 assert.equal((home.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.match(home,/finally:[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(home,/if \(tab_status, marker_status, home_status\) != \([\s\S]*?"tabs-present-bounded", "home-marker-unique", "home-static-all"/);
 assert.doesNotMatch(triage,/input", "tap|input", "swipe|input", "keyevent|tap_node|performAction/);
});

test('policy records 5s BLOCK, 30s PASS, and no production approval',()=>{
 for(const value of ['M65','M66','30.0 seconds','5.0 seconds','2/2','fail-fast: false','PPP','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','No synthetic transaction'])
   assert.ok(doc.includes(value),value);
 assert.match(doc,/one PASS at 30s/i);
 assert.match(doc,/not proof/i);
});
