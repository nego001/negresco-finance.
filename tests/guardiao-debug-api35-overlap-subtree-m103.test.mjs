import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-overlap-census-m102.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-overlap-subtree-m103.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_overlap_subtree_m103.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_OVERLAP_SUBTREE_M103.md','utf8');
test('M103 exact M102 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug API35 overlap census M102","Guardiao Debug API35 overlap subtree M103"],["lab/p01-guardiao-debug-api35-overlap-census-m102-v1","lab/p01-guardiao-debug-api35-overlap-subtree-m103-v1"],["guardiao-debug-api35-overlap-census-m102-","guardiao-debug-api35-overlap-subtree-m103-"],["M102 API ${{ matrix.api }} - overlap census","M103 API ${{ matrix.api }} - overlap subtree"],["Apply exact M101 control plus private overlap census","Apply exact M102 control plus common subtree diagnostic"],["guardiao_debug_api35_overlap_census_m102.py apply","guardiao_debug_api35_overlap_subtree_m103.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-overlap-subtree-m103-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_overlap_subtree_m103 as m',
 'import guardiao_debug_api35_overlap_census_m102 as a',
 'orig=m.GUARD.read_text(encoding="utf-8")',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M103 reversible subtree-only change preserves guard and snapshot reader',()=>run([
 'control=a.census_transform(orig)',
 'out=m.subtree_transform(orig)',
 'ast.parse(out)',
 'assert out.removesuffix(m.HELPER).replace(m.NEW,m.OLD)==control',
 'assert out.count("return reject")==control.count("return reject")',
 'assert m.m91_pure is a.m91_pure and m.xml_transform is a.xml_transform and m.organized_transform is a.organized_transform',
 'for bad in ("",orig+orig,out):',
 ' try: m.subtree_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M103 synthetic minimal common subtree distinguishes inside and outside branches',()=>run([
 'env={}',
 'exec(m.subtree_transform(orig),env)',
 'def node(parent, ident="", klass="android.view.ViewGroup"):',
 ' return {"_m100_parent":str(parent),"resource-id":ident,"package":env["PACKAGE"],"class":klass}',
 'native=node(-1,"android:id/content","android.widget.FrameLayout")',
 'app=node(0)',
 'header=node(1,env["HOME_ID"]+"no")',
 'quick=node(1,"negresco-lab-quick-pix-layout-fixture")',
 'tabs=[node(1,x) for x in env["TARGETS"]]',
 'inside=node(1,"private-fixture")',
 'outside=node(0)',
 'separate=node(-1)',
 'nodes=[native,app,header,quick,*tabs,inside,outside,separate]',
 'def invoke(blocker):',
 ' stream=io.StringIO()',
 ' with contextlib.redirect_stdout(stream): env["_m103_report_subtree"](nodes,blocker)',
 ' return stream.getvalue().splitlines()',
 'assert invoke(inside)[0]=="ENV (LAB): m103-subtree-relation=inside-anchor-subtree"',
 'assert invoke(outside)==["ENV (LAB): m103-subtree-"+x for x in ("relation=outside-anchor-subtree-shared-ancestor","anchor-root-kind=viewgroup","blocker-parent-kind=android-content","common-kind=android-content","branch=direct-sibling")]',
 'assert invoke(separate)[0]=="ENV (LAB): m103-subtree-relation=outside-anchor-subtree-separate-root"',
 'assert invoke(native)[0]=="ENV (LAB): m103-subtree-relation=ancestor-of-anchor-subtree"',
 'assert invoke(app)[0]=="ENV (LAB): m103-subtree-relation=anchor-subtree-root"',
 'quick["_m100_parent"]="3"',
 'assert invoke(outside)==["ENV (LAB): m103-subtree=unconfirmed"]'
]));
test('M103 preserves M102 evidence and production gates',()=>{
 for(const x of ['M102','1,801/1,801','single','no-scroll-ancestor','unknown','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
