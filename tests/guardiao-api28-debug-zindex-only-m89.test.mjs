import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
historicalAppPath();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-api28-debug-root-hitorder-restored-m88.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-zindex-only-m89.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_api28_debug_zindex_only_m89.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_ZINDEX_ONLY_M89.md','utf8');

test('M89 workflow differs from M88 only by names refs and scoped source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao API28 Debug root hit-order restoration control M88","Guardiao API28 Debug zIndex-only root control M89"],["lab/p01-guardiao-api28-debug-root-hitorder-restored-m88-v1","lab/p01-guardiao-api28-debug-zindex-only-m89-v1"],["guardiao-debug-root-restored-m88-","guardiao-debug-zindex-only-m89-"],["M88 trial ","M89 trial "],["restore root hit-order only","retain root zIndex only"],["Apply exact M84 two-style subtraction with root hit-order preserved","Apply exact M88 control minus root elevation"],["guardiao_api28_debug_root_hitorder_restored_m88.py apply","guardiao_api28_debug_zindex_only_m89.py apply"],["Verify original guarded Pix cycle with root hit-order retained","Verify original guarded Pix cycle with root zIndex only"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-zindex-only-m89-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
 assert.ok(patch.includes('if not path.is_file() or path.is_symlink():'));
 for(const s of ['trial: [1, 2]','fail-fast: false','api-level: 28','script: python3 tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py']) assert.ok(current.includes(s));
});

const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_zindex_only_m89 as m',
 'import guardiao_api28_debug_root_hitorder_restored_m88 as a',
 "orig=open('tooling/android/fixtures/m139-historical-baseline/App.tsx',encoding='utf-8').read()",
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M89 pure transform removes only one root property beyond M88',()=>run([
 'control=a.transform(orig)',
 'out=m.transform(orig)',
 'assert out==control.replace(m.OLD,m.NEW) and out!=control',
 'assert out.replace(m.NEW,m.OLD)==control',
 'assert out.count(m.NEW)==1 and m.OLD not in out',
 'assert out.count(m.ROOT_STYLE)==1',
 "assert out.count('style={s.bottom}')==1",
 "assert out.count('style={[s.nav,page===x.name&&s.navSelected]}')==1"
]));
test('M89 rejects absent duplicate premodified and wrong root definitions',()=>run([
 "for bad in ('',None,orig+orig,m.transform(orig),orig.replace(m.OLD,m.NEW),orig.replace(m.OLD,'labAndroidRootHitOrder:{zIndex:3,elevation:4},'),orig.replace(m.ROOT_STYLE,'')):",
 ' try: m.transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M89 retains historical failures and production gates',()=>{
 for(const x of ['M84','M85b','M86b','M87','M88','2/2 PASS','2/2 FAIL','1,744/1,744','PPP','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
