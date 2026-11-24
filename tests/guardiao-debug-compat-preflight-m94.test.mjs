import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-zindex-one-compat-m93.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-compat-preflight-m94.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_compat_preflight_m94.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_COMPAT_PREFLIGHT_M94.md','utf8');
test('M94 exact M93 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug zIndex-one compatibility M93","Guardiao Debug compatibility preflight diagnostics M94"],["lab/p01-guardiao-debug-zindex-one-compat-m93-v1","lab/p01-guardiao-debug-compat-preflight-m94-v1"],["guardiao-debug-zindex-one-compat-m93-","guardiao-debug-compat-preflight-m94-"],["M93 API ${{ matrix.api }} - retain root zIndex one","M94 API ${{ matrix.api }} - preflight checkpoints"],["Apply exact M91 source and exact matrix SDK gate","Apply exact M93 control plus fixed preflight checkpoints"],["guardiao_debug_zindex_one_compat_m93.py apply","guardiao_debug_compat_preflight_m94.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-compat-preflight-m94-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_compat_preflight_m94 as m',
 'import guardiao_debug_zindex_one_compat_m93 as a',
 "orig=m.OBSERVER.read_text(encoding='utf-8')",
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M94 thirteen literal labels reversible to exact M93 control on both APIs',()=>run([
 'assert m.m91_pure is a.m91_pure',
 'assert len(m.ANCHORS)==13',
 'assert len({c for _,c in m.ANCHORS})==13',
 'for api in m.APIS:',
 ' control=a.observer_transform(orig,api)',
 ' out=m.diagnostic_transform(orig,api)',
 ' ast.parse(out)',
 ' for anchor,category in m.ANCHORS:',
 '  marker=m.checkpoint_line(category)',
 '  assert out.count(marker)==1 and marker+anchor in out',
 '  out=out.replace(marker,"")',
 ' assert out==control'
]));
test('M94 rejects missing duplicate or premodified anchors and unlisted API',()=>run([
 "anchor,category=m.ANCHORS[0]",
 "for bad in ('',None,orig+orig,orig.replace(anchor,''),orig.replace(anchor,anchor+'\\n'+anchor),orig.replace(anchor,m.checkpoint_line(category)+anchor),m.diagnostic_transform(orig,'29')):",
 " try: m.diagnostic_transform(bad,'29'); raise AssertionError('must reject')",
 ' except RuntimeError: pass',
 "for api in ('28','34','36',None,29,True):",
 " try: m.diagnostic_transform(orig,api); raise AssertionError('must reject')",
 ' except RuntimeError: pass'
]));
test('M94 retains preflight block classification and production gates',()=>{
 for(const x of ['M93','preflight-pending','1,764/1,764','no Pix tap','initial PPP','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
