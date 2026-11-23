import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const oldWorkflow=readFileSync('.github/workflows/guardiao-api28-debug-two-cycle-repeat-m77.yml','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-pre-pix-categorical-m78.yml','utf8');
const navigation=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const staging=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const helper=readFileSync('tooling/android/guardiao_api28_debug_pre_pix_diagnostic_lab.py','utf8');
const external=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_PRE_PIX_DIAG_M78.md','utf8');

test('M78 replicates M77 workflow except labels and branch',()=>{
 let expected=oldWorkflow;
 const changes=[["name: Guardiao API28 Debug same-PID two-cycle independent repeats M77","name: Guardiao API28 Debug pre-Pix categorical repeat M78"],["lab/p01-guardiao-api28-debug-two-cycle-repeat-m77-v1","lab/p01-guardiao-api28-debug-pre-pix-categorical-m78-v1"],["guardiao-debug-two-cycle-repeat-m77-","guardiao-debug-pre-pix-m78-"],["name: M77 trial ${{ matrix.trial }} - two guarded cycles in one Debug PID","name: M78 trial ${{ matrix.trial }} - pre-Pix diagnostic two-cycle Debug"],["name: Validate two guarded preview cycles per independent Debug emulator","name: Classify existing pre-Pix gates in two independent Debug emulators"]];
 for(const [a,b] of changes) {
  assert.equal(expected.split(a).length,2,a);
  expected=expected.replace(a,b);
 }
 assert.equal(workflow,expected);
 assert.match(workflow,/trial: \[1, 2\]/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|secrets\./);
});

test('M78 categorizes original first Pix candidate gates but never bypasses them',()=>{
 for(const category of ['not-started','pre-pix-process-or-focus-unconfirmed','pre-pix-snapshot-unconfirmed',
 'pre-pix-classifier-unconfirmed','pre-pix-target-unconfirmed','pre-pix-target-attested'])
 assert.ok(helper.includes('"' + category + '"'),category);
 assert.match(navigation,/PRE_PIX_DIAGNOSTIC = "not-started"/);
 assert.match(navigation,/PRE_PIX_DIAGNOSTIC = "pre-pix-process-or-focus-unconfirmed"/);
 assert.match(navigation,/PRE_PIX_DIAGNOSTIC = "pre-pix-snapshot-unconfirmed"/);
 assert.match(navigation,/PRE_PIX_DIAGNOSTIC = "pre-pix-classifier-unconfirmed"/);
 assert.match(navigation,/PRE_PIX_DIAGNOSTIC = "pre-pix-target-unconfirmed"/);
 assert.match(navigation,/PRE_PIX_DIAGNOSTIC = "pre-pix-target-attested"/);
 assert.match(navigation,/if category != gate\.ELIGIBLE or pix_center is None:/);
 assert.match(navigation,/STAGE\.advance\("pix-candidate-attested"\)/);
 assert.match(staging,/ENV \(LAB\): debug-nav-pre-pix=/);
 assert.match(staging,/if pre_pix not in PRE_PIX_CATEGORIES:/);
 assert.doesNotMatch(helper,/\.adb\(|subprocess|xml_nodes\(|print\(|import\s+logging\b|socket|time\.sleep|requests|urllib/);
});

test('M78 leaves original touch counts, wait intervals, snapshots, PPP and mandatory cleanup intact',()=>{
 assert.equal((navigation.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((navigation.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((navigation.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((navigation.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(navigation,/finally:\s*\n\s*# Always delete exactly as before,[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(navigation,/SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"/);
 assert.match(external,/time\.sleep\(30\.0\)/);
 assert.match(external,/\("idle-observed", "all-present", "PPP"\)/);
 assert.match(staging,/CYCLES: tuple\[str, str\] = \("first", "second"\)/);
 assert.doesNotMatch(staging,/"input"|"tap"|time\.sleep|xml_nodes\(/);
});

test('M78 records historical M77 BLOCK and all release restrictions',()=>{
 for(const token of ['M75','M76','M77','M78','45100825061','45100825065','1,687/1,688',
  'home-attested','pre-pix-target-unconfirmed','#120','#126','approvedForProduction=false',
  'stableReleaseAllowed=false','Draft','No retries','no PDF'])
   assert.ok(policy.includes(token),token);
});
