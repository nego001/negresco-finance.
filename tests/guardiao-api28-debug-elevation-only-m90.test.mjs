import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
historicalAppPath();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-api28-debug-zindex-only-m89.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-elevation-only-m90.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_api28_debug_elevation_only_m90.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_ELEVATION_ONLY_M90.md','utf8');

test('M90 workflow differs from M89 only by names refs and scoped source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao API28 Debug zIndex-only root control M89","Guardiao API28 Debug elevation-only root control M90"],["lab/p01-guardiao-api28-debug-zindex-only-m89-v1","lab/p01-guardiao-api28-debug-elevation-only-m90-v1"],["guardiao-debug-zindex-only-m89-","guardiao-debug-elevation-only-m90-"],["M89 trial ","M90 trial "],["retain root zIndex only","retain root elevation only"],["Apply exact M88 control minus root elevation","Apply exact M88 control minus root zIndex"],["guardiao_api28_debug_zindex_only_m89.py apply","guardiao_api28_debug_elevation_only_m90.py apply"],["Verify original guarded Pix cycle with root zIndex only","Verify original guarded Pix cycle with root elevation only"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-elevation-only-m90-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
 assert.ok(patch.includes('if not path.is_file() or path.is_symlink():'));
 for(const s of ['trial: [1, 2]','fail-fast: false','api-level: 28','script: python3 tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py']) assert.ok(current.includes(s));
});

const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_elevation_only_m90 as m',
 'import guardiao_api28_debug_root_hitorder_restored_m88 as a',
 'import guardiao_api28_debug_zindex_only_m89 as b',
 "orig=open('tooling/android/fixtures/m139-historical-baseline/App.tsx',encoding='utf-8').read()",
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M90 pure transform removes only root zIndex beyond M88 and is complementary to M89',()=>run([
 'control=a.transform(orig)',
 'out=m.transform(orig)',
 'assert out==control.replace(m.OLD,m.NEW) and out!=control',
 'assert out.replace(m.NEW,m.OLD)==control',
 'assert out.count(m.NEW)==1 and m.OLD not in out',
 "assert m.NEW=='labAndroidRootHitOrder:{elevation:4},'",
 'assert out.replace(m.NEW,b.NEW)==b.transform(orig)',
 'assert out.count(m.ROOT_STYLE)==1',
 "assert out.count('style={s.bottom}')==1",
 "assert out.count('style={[s.nav,page===x.name&&s.navSelected]}')==1"
]));
test('M90 rejects absent duplicate premodified and wrong root definitions',()=>run([
 "for bad in ('',None,orig+orig,m.transform(orig),b.transform(orig),orig.replace(m.OLD,m.NEW),orig.replace(m.OLD,b.NEW),orig.replace(m.OLD,'labAndroidRootHitOrder:{zIndex:4,elevation:3},'),orig.replace(m.ROOT_STYLE,'')):",
 ' try: m.transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M90 retains historical failures and production gates',()=>{
 for(const x of ['M84','M85b','M86b','M87','M88','M89','2/2 PASS','2/2 FAIL','1,748/1,748','PPP','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
