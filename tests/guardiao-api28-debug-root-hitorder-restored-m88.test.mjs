import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
historicalAppPath();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const old=readFileSync('.github/workflows/guardiao-api28-debug-touch-chain-m87.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-root-hitorder-restored-m88.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_api28_debug_root_hitorder_restored_m88.py','utf8');
const priorM84=readFileSync('tooling/android/guardiao_api28_debug_legacy_nav_variant_m84.py','utf8');
const app=readFileSync(historicalAppPath(),'utf8');
const nav=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const stage=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_ROOT_HITORDER_RESTORED_M88.md','utf8');

test('M88 source-identical M87 workflow except names, refs, labels and one source prep CLI',()=>{
 let expected=old;
 for(const [a,b] of [["name: Guardiao API28 Debug exact post-Pix touch-chain markers M87","name: Guardiao API28 Debug root hit-order restoration control M88"],["lab/p01-guardiao-api28-debug-touch-chain-m87-v1","lab/p01-guardiao-api28-debug-root-hitorder-restored-m88-v1"],["guardiao-debug-touch-chain-m87-","guardiao-debug-root-restored-m88-"],["name: M87 trial ${{ matrix.trial }} - source-defined touch-chain flags","name: M88 trial ${{ matrix.trial }} - restore root hit-order only"],["name: Apply exact three source style removals after M85 branch-scope failure","name: Apply exact M84 two-style subtraction with root hit-order preserved"],["python3 tooling/android/guardiao_api28_debug_touch_preflight_m87.py apply","python3 tooling/android/guardiao_api28_debug_root_hitorder_restored_m88.py apply"],["name: Classify existing post-Pix event flags without extra Android reads","name: Verify original guarded Pix cycle with root hit-order retained"]]){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(current,expected);
 const fromWorkflow=current.match(/^\s+- (lab\/p01-guardiao-api28-debug-root-hitorder-restored-m88-v1)$/m)?.[1];
 const fromScript=patch.match(/LAB_REF = "refs\/heads\/([^"]+)"/)?.[1];
 assert.equal(fromWorkflow,fromScript);
 assert.match(patch,/GITHUB_ACTIONS/);
 assert.match(patch,/GITHUB_REF/);
 assert.match(patch,/from guardiao_api28_debug_legacy_nav_variant_m84 import transform as m84_pure/);
 assert.doesNotMatch(current,/python3 tooling\/android\/guardiao_api28_debug_touch_preflight_m87\.py apply/);
 assert.match(current,/trial: \[1, 2\]/);
 assert.match(current,/fail-fast: false/);
 assert.match(current,/api-level: 28/);
 assert.match(current,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(current,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M88 existing controlled guards and M87 failure-only event categories unchanged',()=>{
 assert.equal((nav.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.equal((nav.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((nav.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 assert.equal((nav.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((nav.match(/BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/g)||[]).length,1);
 assert.equal((nav.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((nav.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.match(nav,/TOUCH_CHAIN_DIAGNOSTIC = touch_chain\.classify_home_visible\(nodes\)/);
 assert.match(stage,/ENV \(LAB\): debug-nav-touch-chain=/);
 assert.equal((app.match(/Platform\.OS==='android'&&s\.labAndroidRootHitOrder/g)||[]).length,1);
 assert.equal((app.match(/style=\{\[s\.bottom,s\.labBottomBounds\]\}/g)||[]).length,1);
 assert.equal((app.match(/style=\{\[s\.nav,s\.labNavBounds,page===x\.name&&s\.navSelected\]\}/g)||[]).length,1);
});
test('M88 pure transform removes exactly two nav height overrides, root modifier remains intact',()=>{
 const py=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_root_hitorder_restored_m88 as m',
 'import guardiao_api28_debug_legacy_nav_variant_m84 as a',
 'import guardiao_api28_debug_touch_preflight_m87 as b',
 "orig=open('tooling/android/fixtures/m139-historical-baseline/App.tsx',encoding='utf-8').read()",
 'restored=m.transform(orig)',
 'assert restored==a.transform(orig)',
 "assert restored.count(m.ROOT_STYLE)==1",
 'assert restored!=b.transform(orig)',
 "assert restored.count('style={s.bottom}')==1",
 "assert restored.count('style={[s.nav,page===x.name&&s.navSelected]}')==1",
 "for bad in ('',restored,orig+orig):",
 ' try: m.transform(bad); raise AssertionError("must fail")',
 ' except RuntimeError: pass',
 "print('PASS (LAB): exact two-style restoration control, original root style retained')"
 ].join('\n');
 const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS \(LAB\): exact two-style restoration control, original root style retained/);
 assert.match(priorM84,/LAB_REF = "refs\/heads\/lab\/p01-guardiao-api28-debug-legacy-nav-m84-v1"/);
 assert.match(patch,/if not path\.is_file\(\) or path\.is_symlink\(\):/);
 assert.doesNotMatch(patch,/\.adb\(|xml_nodes\(|\binput\(|\bscreenshot\(|\bprint\(.*nodes|subprocess\.|os\.system\(/);
});
test('M88 historic native FAIL and production blocks explicitly retained',()=>{
 for(const x of ['M77','M79','M81','M83','M84','M85','M85b','M86','M86b','M87','M88',
 '1,740/1,740','#120','#126','approvedForProduction=false','stableReleaseAllowed=false','Draft'])
   assert.ok(doc.includes(x),x);
});
