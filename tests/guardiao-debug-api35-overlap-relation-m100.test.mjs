import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-target-guard-m99.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-overlap-relation-m100.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_overlap_relation_m100.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_OVERLAP_RELATION_M100.md','utf8');
test('M100 exact M99 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug API35 target guard M99","Guardiao Debug API35 overlap relation M100"],["lab/p01-guardiao-debug-api35-target-guard-m99-v1","lab/p01-guardiao-debug-api35-overlap-relation-m100-v1"],["guardiao-debug-api35-target-guard-m99-","guardiao-debug-api35-overlap-relation-m100-"],["M99 API ${{ matrix.api }} - target guard","M100 API ${{ matrix.api }} - overlap relation"],["Apply exact M98 control plus fixed target rejection categories","Apply exact M99 control plus private overlap relation"],["guardiao_debug_api35_target_guard_m99.py apply","guardiao_debug_api35_overlap_relation_m100.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-overlap-relation-m100-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, re, io, contextlib, xml.etree.ElementTree as ET',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_overlap_relation_m100 as m',
 'orig=m.GUARD.read_text(encoding="utf-8")',
 'base=m.BASE.read_text(encoding="utf-8")',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M100 reversible guard diagnostic and private snapshot links only',()=>run([
 'control=m.guard_transform(orig)',
 'out=m.overlap_transform(orig)',
 'ast.parse(out)',
 'assert out.removesuffix(m.HELPER).replace(m.NEW,m.OLD)==control',
 'assert m.xml_transform(base).replace(m.NEW_XML,m.OLD_XML)==base',
 'ast.parse(m.xml_transform(base))',
 'assert m.OLD_XML.count("adb(")==m.NEW_XML.count("adb(")==2',
 'assert m.NEW_XML.count("ET.fromstring(")==1',
 'for f,source in ((m.xml_transform,base),(m.overlap_transform,orig)):',
 ' for bad in ("",source+source,f(source)):',
 '  try: f(bad); raise AssertionError("must reject")',
 '  except RuntimeError: pass'
]));
test('M100 same XML read retains original attributes and correct private ancestry',()=>run([
 'fixture="<hierarchy><node resource-id=\'root\' clickable=\'true\' enabled=\'true\' bounds=\'[0,0][10,10]\'><node resource-id=\'child\'/><node resource-id=\'second\'><node resource-id=\'leaf\'/></node></node><node resource-id=\'outside\'/></hierarchy>"',
 'def invoke(src):',
 ' calls=[]',
 ' def adb(*args,**kwargs): calls.append((args,kwargs)); return fixture',
 ' env={"adb":adb,"ET":ET}',
 ' exec(src,env)',
 ' result=env["xml_nodes"]()',
 ' assert len(calls)==2',
 ' return result,calls',
 'before,oldcalls=invoke(m.OLD_XML)',
 'after,newcalls=invoke(m.NEW_XML)',
 'assert oldcalls==newcalls',
 'assert [{k:v for k,v in n.items() if k!="_m100_parent"} for n in after]==before',
 'assert [n["_m100_parent"] for n in after]==["-1","0","0","2","-1"]',
 'env={}',
 'exec(m.overlap_transform(orig),env)',
 'rel=env["_m100_relation"]',
 'assert rel(after,after[1],after[0])=="blocker-ancestor"',
 'assert rel(after,after[0],after[3])=="blocker-descendant"',
 'assert rel(after,after[1],after[4])=="separate-branch"',
 'after[1]["_m100_parent"]="1"',
 'assert rel(after,after[1],after[0])=="relation-unconfirmed"',
 'assert rel(before,before[1],before[0])=="relation-unconfirmed"'
]));
test('M100 fixed categories and original reject remain intact',()=>run([
 'env={}',
 'exec(m.overlap_transform(orig),env)',
 'target={"_m100_parent":"0"}',
 'blocker={"_m100_parent":"-1","package":env["PACKAGE"],"class":"android.view.ViewGroup","resource-id":""}',
 'stream=io.StringIO()',
 'with contextlib.redirect_stdout(stream): env["_m100_report_overlap"]([blocker,target],target,blocker,(2,2,4,4),(0,0,10,10))',
 'assert stream.getvalue().splitlines()==["ENV (LAB): m100-overlap-"+x for x in ("relation=blocker-ancestor","owner=app-owned","class=viewgroup","identity=empty-id","shape=contains-target")]',
 'assert m.NEW.endswith("return reject")',
 'assert m.overlap_transform(orig).count("return reject")==orig.count("return reject")'
]));
test('M100 preserves M99 evidence and production gates',()=>{
 for(const x of ['M99','1,788/1,788','other-clickable-covers-center','no Pix tap','PPP','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
