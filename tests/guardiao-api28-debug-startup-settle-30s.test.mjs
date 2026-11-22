import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const runner=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const triage=readFileSync('tooling/android/guardiao_api28_debug_native_transport_triage_lab.py','utf8');
const home=readFileSync('tooling/android/guardiao_api28_debug_home_readiness_census_lab.py','utf8');
const observer=readFileSync('tooling/android/a11y-debug-observer-lab/app/src/main/java/com/negresco/a11ydebugobserver/lab/ObserveInstrumentation.java','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-startup-settle-30s.yml','utf8');
const original=readFileSync('.github/workflows/guardiao-api28-debug-native-transport-triage.yml','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_STARTUP_SETTLE_30S.md','utf8');

test('M66 uses exactly one bounded 30s settle before first Debug PID/focus/root observation, never retry',()=>{
 assert.equal((runner.match(/time\.sleep\(30\.0\)/g)||[]).length,1);
 assert.doesNotMatch(runner,/time\.sleep\(5\.0\)|while.*sleep|retry_after|retry_on_failure|input", "tap|input", "swipe|input", "keyevent/);
 const launched=runner.indexOf('if "Events injected: 1" not in launched:');
 const sleep=runner.indexOf('time.sleep(30.0)');
 const pid=runner.indexOf('before_pid = debug_pid()');
 const instrument=runner.indexOf('"instrument", "-w", "-r"');
 const callback=runner.indexOf('after_verified_observation()');
 assert.ok(launched>0 && sleep>launched && pid>sleep && instrument>pid && callback>instrument);
 assert.equal((runner.match(/"monkey"/g)||[]).length,1);
 assert.equal((runner.match(/"instrument"/g)||[]).length,1);
 assert.match(runner,/if \(idle, verdict, mask\) != \("idle-observed", "all-present", "PPP"\)/);
 assert.match(runner,/after_pid != before_pid or not debug_focus\(\)/);
});

test('external observer retains exactly three non-retried root reads and no content/gestures',()=>{
 assert.equal((observer.match(/getRootInActiveWindow\(\)/g)||[]).length,1);
 assert.equal((observer.match(/waitForIdle\(1000L, 5000L\)/g)||[]).length,1);
 assert.match(observer,/for \(int i = 1; i <= 3; i\+\+\)/);
 assert.doesNotMatch(observer,/getText\(|getContentDescription\(|getBoundsInScreen\(|getChild\(|takeScreenshot|injectInputEvent|performAction|startActivity/);
});

test('single M65 Home snapshot and temporary XML cleanup remain strictly blocked',()=>{
 assert.match(triage,/home\.passive_home_census\(\)/);
 assert.equal((home.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.match(home,/finally:[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(home,/if \(tab_status, marker_status, home_status\) != \([\s\S]*?"tabs-present-bounded", "home-marker-unique", "home-static-all"/);
});

test('new workflow differs from reviewed M65 only in literal labels and branch',()=>{
 const changes=[
  ['name: Guardiao API28 Debug native bootstrap and Metro transport triage after PPP','name: Guardiao API28 Debug isolated 30s first-read startup settling study'],
  ['lab/p01-guardiao-api28-debug-native-transport-triage-v1','lab/p01-guardiao-api28-debug-startup-settle-30s-v1'],
  ['guardiao-debug-native-transport-','guardiao-debug-settle-30s-'],
  ['name: Debug native startup, Metro routes and Home census after PPP (no gestures)','name: Predeclared 30s startup delay then one Debug PPP/Home census'],
  ['name: Diagnose native Metro routes and a single Debug Home snapshot after PPP','name: Single Debug Home and native census after fixed 30s settling interval'],
 ];
 let expected=original;
 for(const [before,after] of changes){
  assert.ok(expected.includes(before),before);
  expected=expected.replace(before,after);
 }
 assert.equal(workflow,expected);
 for(const required of ['api-level: 28','-no-snapshot','assembleDebug','contents: read','persist-credentials: false','a11y-debug-observer-lab/build_observer.sh','guardiao_api28_debug_native_transport_triage_lab.py'])
   assert.ok(workflow.includes(required),required);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
});

test('explicit preregistration preserves P0s and negative evidence from 5s baseline',()=>{
 for(const value of ['M65','5.0 seconds','30.0 seconds','pre-first-read','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','BLOCK','No clicks'])
  assert.ok(policy.includes(value),value);
});
