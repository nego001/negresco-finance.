import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-overlap-relation-m100.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-overlap-anchors-m101.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_overlap_anchors_m101.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_OVERLAP_ANCHORS_M101.md','utf8');
test('M101 exact M100 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug API35 overlap relation M100","Guardiao Debug API35 overlap anchors M101"],["lab/p01-guardiao-debug-api35-overlap-relation-m100-v1","lab/p01-guardiao-debug-api35-overlap-anchors-m101-v1"],["guardiao-debug-api35-overlap-relation-m100-","guardiao-debug-api35-overlap-anchors-m101-"],["M100 API ${{ matrix.api }} - overlap relation","M101 API ${{ matrix.api }} - overlap anchors"],["Apply exact M99 control plus private overlap relation","Apply exact M100 control plus existing anchor relations"],["guardiao_debug_api35_overlap_relation_m100.py apply","guardiao_debug_api35_overlap_anchors_m101.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-overlap-anchors-m101-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_overlap_anchors_m101 as m',
 'import guardiao_debug_api35_overlap_relation_m100 as a',
 'orig=m.GUARD.read_text(encoding="utf-8")',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M101 reversible anchor-only change retains original guard and metadata readers',()=>run([
 'control=a.overlap_transform(orig)',
 'out=m.anchors_transform(orig)',
 'ast.parse(out)',
 'assert out.removesuffix(m.HELPER).replace(m.NEW,m.OLD)==control',
 'assert out.count("return reject")==control.count("return reject")',
 'assert m.m91_pure is a.m91_pure and m.xml_transform is a.xml_transform and m.organized_transform is a.organized_transform',
 'for bad in ("",orig+orig,out):',
 ' try: m.anchors_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M101 anchor relations distinguish known content from tabs without raw output',()=>run([
 'env={}',
 'exec(m.anchors_transform(orig),env)',
 'def node(parent,ident="",owner=None):',
 ' return {"_m100_parent":str(parent),"resource-id":ident,"package":env["PACKAGE"] if owner is None else owner}',
 'root=node(-1)',
 'header=node(0,env["HOME_ID"]+"no")',
 'blocker=node(0)',
 'quick=node(2,"negresco-lab-quick-pix-layout-fixture")',
 'bar=node(0)',
 'home=node(4,env["TARGETS"][0])',
 'pix=node(4,env["TARGETS"][1])',
 'negresco=node(4,env["TARGETS"][2])',
 'nodes=[root,header,blocker,quick,bar,home,pix,negresco]',
 'env["observer"].debug.safe_testid_matches', 
 'def invoke(nodes,target,blocker):',
 ' stream=io.StringIO()',
 ' with contextlib.redirect_stdout(stream): env["_m101_report_anchors"](nodes,target,blocker)',
 ' return stream.getvalue().splitlines()',
 'rel=env["_m101_anchor_relation"]',
 'assert rel(nodes,blocker,[quick])=="blocker-ancestor"',
 'assert rel(nodes,blocker,[header])=="separate-branch"',
 'assert rel(nodes,blocker,[root])=="blocker-descendant"',
 'assert rel(nodes,blocker,[blocker])=="same-node"',
 'assert rel(nodes,blocker,[])=="anchor-absent"',
 'assert rel(nodes,blocker,[quick,header])=="anchor-ambiguous"',
 'lines=invoke(nodes,pix,blocker)',
 'assert lines[0]=="ENV (LAB): m101-anchor-page-header=separate-branch"',
 'assert lines[1]=="ENV (LAB): m101-anchor-quick-pix=blocker-ancestor"',
 'assert lines[-1]=="ENV (LAB): m101-anchor-parent=distinct-immediate-parent"',
 'assert len(lines)==6 and all("fixture" not in line and "negresco-lab" not in line for line in lines)',
 'quick["_m100_parent"]="3"',
 'assert rel(nodes,blocker,[quick])=="relation-unconfirmed"'
]));
test('M101 original rejection and production gates retained',()=>{
 for(const x of ['M100','1,793/1,793','separate-branch','app-owned','viewgroup','empty-id','partial-overlap','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
