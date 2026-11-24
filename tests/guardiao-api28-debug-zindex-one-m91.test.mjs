import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-api28-debug-zindex-only-m89.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-zindex-one-m91.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_api28_debug_zindex_one_m91.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_ZINDEX_ONE_M91.md','utf8');
test('M91 exact M89 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao API28 Debug zIndex-only root control M89","Guardiao API28 Debug zIndex-one root control M91"],["lab/p01-guardiao-api28-debug-zindex-only-m89-v1","lab/p01-guardiao-api28-debug-zindex-one-m91-v1"],["guardiao-debug-zindex-only-m89-","guardiao-debug-zindex-one-m91-"],["M89 trial ","M91 trial "],["retain root zIndex only","retain root zIndex one"],["Apply exact M88 control minus root elevation","Apply exact M89 control with root zIndex one"],["guardiao_api28_debug_zindex_only_m89.py apply","guardiao_api28_debug_zindex_one_m91.py apply"],["Verify original guarded Pix cycle with root zIndex only","Verify original guarded Pix cycle with root zIndex one"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-zindex-one-m91-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
 assert.ok(patch.includes('if not path.is_file() or path.is_symlink():'));
 for(const s of ['trial: [1, 2]','fail-fast: false','api-level: 28','script: python3 tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py']) assert.ok(current.includes(s));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_zindex_one_m91 as m',
 'import guardiao_api28_debug_zindex_only_m89 as a',
 'import guardiao_api28_debug_elevation_only_m90 as b',
 "orig=open('apps/mobile/App.tsx',encoding='utf-8').read()",
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M91 changes only the root zIndex value compared to M89',()=>run([
 'control=a.transform(orig)',
 'out=m.transform(orig)',
 'assert out==control.replace(m.OLD,m.NEW) and out!=control',
 'assert out.replace(m.NEW,m.OLD)==control',
 "assert m.NEW=='labAndroidRootHitOrder:{zIndex:1},'",
 'assert out.count(m.NEW)==1 and m.OLD not in out and m.ORIGINAL not in out',
 'assert out.count(m.ROOT_STYLE)==1',
 "assert out.count('style={s.bottom}')==1",
 "assert out.count('style={[s.nav,page===x.name&&s.navSelected]}')==1"
]));
test('M91 rejects absent duplicate premodified and wrong root definitions',()=>run([
 "for bad in ('',None,orig+orig,m.transform(orig),a.transform(orig),b.transform(orig),orig.replace(m.ORIGINAL,m.NEW),orig.replace(m.ORIGINAL,m.OLD),orig.replace(m.ORIGINAL,'labAndroidRootHitOrder:{zIndex:2,elevation:4},'),orig.replace(m.ROOT_STYLE,'')):",
 ' try: m.transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M91 preserves the native failure history and production gates',()=>{
 for(const x of ['M84','M85b','M86b','M87','M88','M89','M90','2/2 PASS','2/2 FAIL','1,752/1,752','PPP','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
