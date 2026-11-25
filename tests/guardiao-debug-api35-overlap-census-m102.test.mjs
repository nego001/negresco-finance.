import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-overlap-anchors-m101.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-overlap-census-m102.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_overlap_census_m102.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_OVERLAP_CENSUS_M102.md','utf8');
test('M102 exact M101 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug API35 overlap anchors M101","Guardiao Debug API35 overlap census M102"],["lab/p01-guardiao-debug-api35-overlap-anchors-m101-v1","lab/p01-guardiao-debug-api35-overlap-census-m102-v1"],["guardiao-debug-api35-overlap-anchors-m101-","guardiao-debug-api35-overlap-census-m102-"],["M101 API ${{ matrix.api }} - overlap anchors","M102 API ${{ matrix.api }} - overlap census"],["Apply exact M100 control plus existing anchor relations","Apply exact M101 control plus private overlap census"],["guardiao_debug_api35_overlap_anchors_m101.py apply","guardiao_debug_api35_overlap_census_m102.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-overlap-census-m102-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_overlap_census_m102 as m',
 'import guardiao_debug_api35_overlap_anchors_m101 as a',
 'orig=m.GUARD.read_text(encoding="utf-8")',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M102 reversible census-only change preserves exact rejection and reader',()=>run([
 'control=a.anchors_transform(orig)',
 'out=m.census_transform(orig)',
 'ast.parse(out)',
 'assert out.removesuffix(m.HELPER).replace(m.NEW,m.OLD)==control',
 'assert out.count("return reject")==control.count("return reject")',
 'assert m.m91_pure is a.m91_pure and m.xml_transform is a.xml_transform and m.organized_transform is a.organized_transform',
 'for bad in ("",orig+orig,out):',
 ' try: m.census_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M102 census recognizes only known labels and preserves private bounds and ancestry',()=>run([
 'env={}',
 'exec(m.census_transform(orig),env)',
 'def node(parent, label="", bounds="[0,0][20,20]", owner=None, klass="android.view.ViewGroup"):',
 ' return {"_m100_parent":str(parent),"resource-id":"","package":env["PACKAGE"] if owner is None else owner,"content-desc":label,"class":klass,"bounds":bounds,"enabled":"true","clickable":"true"}',
 'root=node(-1,klass="android.widget.ScrollView")',
 'root["clickable"]="false"',
 'blocker=node(0,"Contas")',
 'target=node(-1,"Pix")',
 'other=node(0,"private fixture")',
 'nodes=[root,blocker,target,other]',
 'identity=env["_m102_identity"]',
 'assert identity(blocker)=="module-accounts" and identity(other)=="unknown"',
 'assert identity(node(0,"Abrir Cartões"))=="quick-cards"',
 'assert identity(node(0,"Contas",owner="com.example.fixture"))=="foreign"',
 'assert env["_m102_scroll_ancestry"](nodes,blocker)=="scroll-ancestor"',
 'def invoke(nodes):',
 ' stream=io.StringIO()',
 ' with contextlib.redirect_stdout(stream): env["_m102_report_census"](nodes,target,blocker,10,10)',
 ' return stream.getvalue().splitlines()',
 'expected=["first-identity=module-accounts","first-scroll=scroll-ancestor","multiplicity=multiple","identity-coverage=mixed-or-foreign","invalid-other-bounds=absent"]',
 'assert invoke(nodes)==["ENV (LAB): m102-"+x for x in expected]',
 'other["clickable"]="false"',
 'expected[2]="multiplicity=single"',
 'expected[3]="identity-coverage=all-known"',
 'assert invoke(nodes)==["ENV (LAB): m102-"+x for x in expected]',
 'blocker["_m100_parent"]="1"',
 'assert env["_m102_scroll_ancestry"](nodes,blocker)=="unconfirmed"',
 'assert invoke([root,target])==["ENV (LAB): m102-census=unconfirmed"]'
]));
test('M102 preserves M101 evidence and production gates',()=>{
 for(const x of ['M101','1,797/1,797','separate-branch','distinct-immediate-parent','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
