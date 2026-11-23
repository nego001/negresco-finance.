import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const old=readFileSync('.github/workflows/guardiao-api28-debug-pre-pix-categorical-m78.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-pre-pix-repeat-m79.yml','utf8');
const diag=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const stage=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const external=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_PRE_PIX_REPEAT_M79.md','utf8');

test('M79 workflow is M78 except labels, isolated branch, and three independent trials',()=>{
 let expected=old;
 const replacementPairs=[["name: Guardiao API28 Debug pre-Pix categorical repeat M78","name: Guardiao API28 Debug pre-Pix three independent repeats M79"],["lab/p01-guardiao-api28-debug-pre-pix-categorical-m78-v1","lab/p01-guardiao-api28-debug-pre-pix-repeat-m79-v1"],["guardiao-debug-pre-pix-m78-","guardiao-debug-pre-pix-m79-"],["name: M78 trial ${{ matrix.trial }} - pre-Pix diagnostic two-cycle Debug","name: M79 trial ${{ matrix.trial }} - two consecutive guarded Debug cycles"],["trial: [1, 2]","trial: [1, 2, 3]"],["name: Classify existing pre-Pix gates in two independent Debug emulators","name: Recheck existing pre-Pix gates in three independent Debug emulators"]];
 for(const [a,b] of replacementPairs) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.match(current,/fail-fast: false/);
 assert.match(current,/trial: \[1, 2, 3\]/);
 assert.match(current,/api-level: 28/);
 assert.match(current,/assembleDebug/);
 assert.match(current,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.match(current,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(current,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M79 preserves strict single-cycle guarded navigation and original diagnostics',()=>{
 assert.equal((diag.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((diag.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((diag.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((diag.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(diag,/STAGE\.advance\("sequence-complete"\)/);
 assert.match(diag,/PRE_PIX_DIAGNOSTIC = "pre-pix-target-attested"/);
 assert.match(diag,/if category != gate\.ELIGIBLE or pix_center is None:/);
 assert.match(stage,/CYCLES: tuple\[str, str\] = \("first", "second"\)/);
 assert.match(stage,/ENV \(LAB\): debug-nav-pre-pix=/);
 assert.match(stage,/ENV \(LAB\): debug-nav-home-return=/);
 assert.doesNotMatch(stage,/"input"|"tap"|time\.sleep|xml_nodes\(/);
 assert.match(external,/time\.sleep\(30\.0\)/);
 assert.match(external,/\("idle-observed", "all-present", "PPP"\)/);
 assert.match(diag,/finally:\s*\n\s*BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
});
test('M79 retains M77 BLOCK and production prohibitions',()=>{
 for(const value of ['M75','M76','M77','M78','M79','#120','#126','Draft',
 '1,692/1,692','approvedForProduction=false','stableReleaseAllowed=false',
 'no retries','no extra touches','no Release APK rebuild','fail-fast: false'])
   assert.ok(policy.includes(value),value);
});
