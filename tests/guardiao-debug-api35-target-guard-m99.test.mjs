import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-organized-display-m98.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-target-guard-m99.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_target_guard_m99.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_TARGET_GUARD_M99.md','utf8');
test('M99 exact M98 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug API35 organized display M98","Guardiao Debug API35 target guard M99"],["lab/p01-guardiao-debug-api35-organized-display-m98-v1","lab/p01-guardiao-debug-api35-target-guard-m99-v1"],["guardiao-debug-api35-organized-display-m98-","guardiao-debug-api35-target-guard-m99-"],["M98 API ${{ matrix.api }} - organized display","M99 API ${{ matrix.api }} - target guard"],["Apply exact M97 control plus literal organized display variant","Apply exact M98 control plus fixed target rejection categories"],["guardiao_debug_api35_organized_display_m98.py apply","guardiao_debug_api35_target_guard_m99.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-target-guard-m99-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, re, io, contextlib, types',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_target_guard_m99 as m',
 'orig=m.GUARD.read_text(encoding="utf-8")',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M99 exact eleven rejection labels reversible with no other semantic change',()=>run([
 'out=m.guard_transform(orig)',
 'tree=ast.parse(out)',
 'assert len(m.CATEGORIES)==11 and len(set(m.CATEGORIES))==11',
 'assert orig==m.EXPECTED_GUARD',
 'class Remove(ast.NodeTransformer):',
 ' def visit_Expr(self,node):',
 '  if isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Name) and node.value.func.id=="print":',
 '   assert len(node.value.args)==1 and isinstance(node.value.args[0],ast.Constant)',
 '   assert node.value.args[0].value in ["ENV (LAB): m99-target-guard="+c for c in m.CATEGORIES]',
 '   return None',
 '  return node',
 'assert ast.dump(Remove().visit(tree))==ast.dump(ast.parse(orig))',
 'for category in m.CATEGORIES:',
 ' assert out.count("ENV (LAB): m99-target-guard="+category)==1',
 'for bad in ("",None,orig+orig,orig+"\\n",out):',
 ' try: m.guard_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M99 synthetic guard preserves rejection and eligible results',()=>run([
 'import guardiao_api28_debug_nav_preview_guard as original',
 'env={"__name__":"m99_fixture"}',
 'exec(m.guard_transform(orig),env)',
 'def invoke(nodes,w=1080,h=2400):',
 ' stream=io.StringIO()',
 ' with contextlib.redirect_stdout(stream): actual=env["select_preview_target"](nodes,w,h,"home","pix")',
 ' assert actual==original.select_preview_target(nodes,w,h,"home","pix")',
 ' return stream.getvalue().strip()',
 'assert invoke(None)=="ENV (LAB): m99-target-guard=input-shape"',
 'assert invoke([])=="ENV (LAB): m99-target-guard=page-state"',
 'page={"package":original.PACKAGE,"resource-id":original.HOME_ID+"0"}',
 'assert invoke([page])=="ENV (LAB): m99-target-guard=target-count"'
]));
test('M99 retains M98 evidence and production gates',()=>{
 for(const x of ['M98','1,784/1,784','organized-default','pre-pix-target-unconfirmed','no Pix tap','PPP','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
