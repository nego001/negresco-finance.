import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-compat-display-focus-m96.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-display-shape-m97.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_display_shape_m97.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_DISPLAY_SHAPE_M97.md','utf8');
test('M97 exact M96 workflow with only API35 and scoped source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug compatibility display focus M96","Guardiao Debug API35 display shape M97"],["lab/p01-guardiao-debug-compat-display-focus-m96-v1","lab/p01-guardiao-debug-api35-display-shape-m97-v1"],["guardiao-debug-compat-display-focus-m96-","guardiao-debug-api35-display-shape-m97-"],["M96 API ${{ matrix.api }} - display focus","M97 API ${{ matrix.api }} - display shape"],["api: [29, 35]","api: [35]"],["Apply exact M95 control plus strict single display focus","Apply exact M96 control plus fixed display shape categories"],["guardiao_debug_compat_display_focus_m96.py apply","guardiao_debug_api35_display_shape_m97.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-display-shape-m97-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, re, io, contextlib',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_display_shape_m97 as m',
 'import guardiao_debug_compat_display_focus_m96 as a',
 "orig=m.OBSERVER.read_text(encoding='utf-8')",
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M97 reversible diagnostic only and exact API35 guard',()=>run([
 'assert m.m91_pure is a.m91_pure',
 'control=a.display_transform(orig,"35")',
 'out=m.shape_transform(orig,"35")',
 'ast.parse(out)',
 'assert out.count(m.NEW)==1 and out.replace(m.NEW,m.OLD)==control',
 'assert out.count("BASE.adb(")==control.count("BASE.adb(")',
 "for api in ('28','29','34','36',None,35,True):",
 " try: m.shape_transform(orig,api); raise AssertionError('must reject')",
 ' except RuntimeError: pass'
]));
test('M97 preserves M96 decisions and emits only fixed failure categories',()=>run([
 'header="WINDOW MANAGER DISPLAY CONTENTS (dumpsys window displays)"',
 'd0="Display: mDisplayId=0"',
 'marker="mCurrentFocus=Window{ab12 u0 com.negresco.finance/.MainActivity}"',
 'valid=header+"\\n"+d0+"\\n"+marker',
 'def invoke(code,raw):',
 ' env={"re":re}',
 ' exec(code,env)',
 ' stream=io.StringIO()',
 ' with contextlib.redirect_stdout(stream): result=env["classify_display_focus"](raw)',
 ' return result,stream.getvalue().strip()',
 'cases=[(valid,""),(valid.replace(d0,d0+" rootTasks=1"),""),(valid.replace(d0,""),"no-display-header"),(valid.replace(d0,"Display: mDisplayId=1"),"default-header-missing"),(valid+"\\n"+d0,"duplicate-default-header"),(valid+"\\nDisplay: mDisplayId=1","multiple-display-headers"),(valid.replace(d0,d0+" private-suffix"),"default-header-format-unconfirmed"),(valid.replace(marker,"mCurrentFocus=null"),""),(valid.replace("finance/","finance.fake/"),""),(valid+"\\n"+marker,""),("", ""),(None,"")]',
 'for raw,category in cases:',
 ' before,_=invoke(a.NEW,raw)',
 ' after,log=invoke(a.NEW.replace(m.OLD,m.NEW),raw)',
 ' assert before==after',
 ' assert log==("ENV (LAB): m97-display-shape="+category if category else "")'
]));
test('M97 retains M96 mixed outcome and production gates',()=>{
 for(const x of ['M96','1,776/1,776','API29 PASS','API35 BLOCK','default-display-unconfirmed','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
