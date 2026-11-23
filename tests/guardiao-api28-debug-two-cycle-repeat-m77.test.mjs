import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const m76=readFileSync('.github/workflows/guardiao-api28-debug-home-return-diagnostic.yml','utf8');
const m77=readFileSync('.github/workflows/guardiao-api28-debug-two-cycle-repeat-m77.yml','utf8');
const navigation=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const sameProcess=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const external=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_TWO_CYCLE_REPEAT_M77.md','utf8');

test('M77 is byte-identical to M76 except isolation, labels and two independent jobs',()=>{
 let expected=m76;
 const changes=[
  ['name: Guardiao API28 Debug first Home return categorical diagnosis','name: Guardiao API28 Debug same-PID two-cycle independent repeats M77'],
  ['lab/p01-guardiao-api28-debug-return-diagnostic-v1','lab/p01-guardiao-api28-debug-two-cycle-repeat-m77-v1'],
  ['guardiao-debug-home-return-diagnostic-','guardiao-debug-two-cycle-repeat-m77-'],
  ['name: Debug guarded two cycles with fixed-category Home-return diagnosis','name: M77 trial ${{ matrix.trial }} - two guarded cycles in one Debug PID'],
  ['    timeout-minutes: 55\n    steps:','    timeout-minutes: 55\n    strategy:\n      fail-fast: false\n      matrix:\n        trial: [1, 2]\n    steps:'],
  ['name: Diagnose Home return within unchanged two-cycle guarded preview','name: Validate two guarded preview cycles per independent Debug emulator']
 ];
 for(const [before,after] of changes){
  assert.equal(expected.split(before).length,2,before);
  expected=expected.replace(before,after);
 }
 assert.equal(m77,expected);
});

test('M77 preserves exactly two fail-closed independent trials and unchanged runner',()=>{
 assert.match(m77,/fail-fast: false/);
 assert.match(m77,/trial: \[1, 2\]/);
 assert.match(m77,/api-level: 28/);
 assert.match(m77,/assembleDebug/);
 assert.match(m77,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.match(m77,/persist-credentials: false/);
 assert.match(m77,/contents: read/);
 assert.doesNotMatch(m77,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
 assert.match(external,/time\.sleep\(30\.0\)/);
 assert.match(external,/\("idle-observed", "all-present", "PPP"\)/);
 assert.match(sameProcess,/CYCLES: tuple\[str, str\] = \("first", "second"\)/);
 assert.match(sameProcess,/navigation\.run_two_step_navigation\(\)/);
 assert.equal((navigation.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((navigation.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((navigation.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(sameProcess,/debug-nav-home-return=/);
 assert.doesNotMatch(sameProcess,/"input"|"tap"|time\.sleep|xml_nodes\(/);
});

test('M77 evidence and production barriers remain separate',()=>{
 for(const text of ['M75','M76','M77','45098940659','45099133335',
    '#120','#126','approvedForProduction=false','stableReleaseAllowed=false',
    'Draft','no retries','same PID','independent','no PDF'])
    assert.ok(policy.includes(text),text);
});
