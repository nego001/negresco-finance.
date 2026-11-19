import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/guardiao-api28-debug-external-a11y-repeat.yml','utf8');
const baseline=readFileSync('.github/workflows/guardiao-api28-debug-external-a11y-readonly.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const observer=readFileSync('tooling/android/a11y-debug-observer-lab/app/src/main/java/com/negresco/a11ydebugobserver/lab/ObserveInstrumentation.java','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_EXTERNAL_READONLY_REPEAT.md','utf8');

test('two predeclared independent API28 trials: no on-failure retry or loss of second result',()=>{
 assert.match(workflow,/trial: \[1, 2\]/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/Independent Debug observer trial \$\{\{ matrix\.trial \}\}/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/emulator-options: .*?-no-snapshot/);
 assert.equal((workflow.match(/reactivecircus\/android-emulator-runner@/g)||[]).length,1);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_api28_debug_external_a11y_readonly_lab\.py/);
 assert.doesNotMatch(workflow,/workflow_dispatch:|schedule:|pull_request:|continue-on-error:|retry|upload-artifact|download-artifact|assembleRelease/);
});
test('new workflow reuses the exact original build, launch and passive observation steps',()=>{
 const normalize=(v)=>v.replace(/^name:.*$/m,'name: REPLACED')
  .replace(/lab\/p01-guardiao-api28-debug-external-a11y-repeat-v1/g,'lab/p01-guardiao-api28-debug-external-a11y-readonly-v1')
  .replace(/guardiao-debug-a11y-repeat-/g,'guardiao-debug-a11y-external-')
  .replace(/    name: 'Independent Debug observer trial \$\{\{ matrix\.trial \}\}'/,"    name: Fresh synthetic Debug home with no-permission UiAutomation observer")
  .replace(/    strategy:\n      fail-fast: false\n      matrix:\n        trial: \[1, 2\]\n/,'');
 assert.equal(normalize(workflow),normalize(baseline));
});
test('only the external Debug app can be classified; runner never acts on finance data',()=>{
 assert.match(runner,/installed\(DEBUG_PACKAGE\) or installed\(OBSERVER_PACKAGE\)/);
 assert.match(runner,/debug_focus\(\)/);
 assert.match(runner,/before_pid = debug_pid\(\)/);
 assert.match(runner,/after_pid = debug_pid\(\)/);
 assert.match(runner,/\("idle-observed", "all-present", "PPP"\)/);
 assert.equal((observer.match(/getRootInActiveWindow\(\)/g)||[]).length,1);
 assert.equal((observer.match(/waitForIdle\(1000L, 5000L\)/g)||[]).length,1);
 assert.match(observer,/for \(int i = 1; i <= 3; i\+\+\)/);
 assert.doesNotMatch(observer,/getText\(|getContentDescription\(|injectInputEvent|performAction|getBoundsInScreen/);
});
test('policy limits inference even if both trials pass',()=>{
 for(const s of ['2/2','API28','PPP','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','No PDF'])
   assert.ok(policy.includes(s),s);
});
