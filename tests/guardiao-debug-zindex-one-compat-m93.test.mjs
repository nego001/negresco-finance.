import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-api28-debug-zindex-one-m91.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-zindex-one-compat-m93.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_zindex_one_compat_m93.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_ZINDEX_ONE_COMPAT_M93.md','utf8');
test('M93 exact workflow delta limits compatibility matrix and preserves navigation script',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao API28 Debug zIndex-one root control M91","Guardiao Debug zIndex-one compatibility M93"],["lab/p01-guardiao-api28-debug-zindex-one-m91-v1","lab/p01-guardiao-debug-zindex-one-compat-m93-v1"],["guardiao-debug-zindex-one-m91-","guardiao-debug-zindex-one-compat-m93-"],["M91 trial ${{ matrix.trial }} - retain root zIndex one","M93 API ${{ matrix.api }} - retain root zIndex one"],["trial: [1, 2]","api: [29, 35]"],["      - name: Apply exact M89 control with root zIndex one\n        run: |","      - name: Apply exact M91 source and exact matrix SDK gate\n        env:\n          M93_EXPECTED_API: ${{ matrix.api }}\n        run: |"],["guardiao_api28_debug_zindex_one_m91.py apply","guardiao_debug_zindex_one_compat_m93.py apply"],["Verify original guarded Pix cycle with root zIndex one","Verify unchanged guarded Pix cycles on selected Android API"],["api-level: 28","api-level: ${{ matrix.api }}"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-zindex-one-compat-m93-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
 for(const s of ['api: [29, 35]','fail-fast: false','script: python3 tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py']) assert.ok(current.includes(s));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_zindex_one_compat_m93 as m',
 'import guardiao_api28_debug_zindex_one_m91 as a',
 "orig=m.OBSERVER.read_text(encoding='utf-8')",
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M93 keeps original app transform and changes only one SDK gate',()=>run([
 'assert m.m91_pure is a.transform',
 'assert orig.count(m.OLD)==1',
 'for api in m.APIS:',
 ' out=m.observer_transform(orig,api)',
 ' ast.parse(out)',
 ' assert out!=orig and m.OLD not in out',
 ' assert out.replace(m.OLD.replace(\'!= "28"\',\'!= "\'+api+\'"\').replace("Android9 API28 not confirmed","M93 exact Android SDK not confirmed"),m.OLD)==orig'
]));
test('M93 exact SDK guard rejects unlisted values and modified sources',()=>run([
 "for api in ('28','26','34','36','',None,29,True):",
 ' try: m.observer_transform(orig,api); raise AssertionError("must reject")',
 ' except RuntimeError: pass',
 "for bad in ('',None,orig+orig,m.observer_transform(orig,'29'),m.observer_transform(orig,'35')):",
 " try: m.observer_transform(bad,'29'); raise AssertionError('must reject')",
 ' except RuntimeError: pass'
]));
test('M93 retains historical failures and production gates',()=>{
 for(const x of ['M91','M92','2/2 PASS','2/2 FAIL','1,760/1,760','PPP','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
