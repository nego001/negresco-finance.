import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-display-shape-m97.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-organized-display-m98.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_organized_display_m98.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_ORGANIZED_DISPLAY_M98.md','utf8');
test('M98 exact M97 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug API35 display shape M97","Guardiao Debug API35 organized display M98"],["lab/p01-guardiao-debug-api35-display-shape-m97-v1","lab/p01-guardiao-debug-api35-organized-display-m98-v1"],["guardiao-debug-api35-display-shape-m97-","guardiao-debug-api35-organized-display-m98-"],["M97 API ${{ matrix.api }} - display shape","M98 API ${{ matrix.api }} - organized display"],["Apply exact M96 control plus fixed display shape categories","Apply exact M97 control plus literal organized display variant"],["guardiao_debug_api35_display_shape_m97.py apply","guardiao_debug_api35_organized_display_m98.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-organized-display-m98-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, re, io, contextlib',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_organized_display_m98 as m',
 'import guardiao_debug_api35_display_shape_m97 as a',
 'import guardiao_debug_compat_display_focus_m96 as b',
 "orig=m.OBSERVER.read_text(encoding='utf-8')",
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M98 reversible one-header delta and exact API35 gate',()=>run([
 'assert m.m91_pure is a.m91_pure',
 'control=a.shape_transform(orig,"35")',
 'out=m.organized_transform(orig,"35")',
 'ast.parse(out)',
 'assert out.count(m.NEW)==1 and out.replace(m.NEW,m.OLD)==control',
 'assert out.count("BASE.adb(")==control.count("BASE.adb(")',
 "for api in ('28','29','34','36',None,35,True):",
 " try: m.organized_transform(orig,api); raise AssertionError('must reject')",
 ' except RuntimeError: pass'
]));
test('M98 literal organized header never bypasses unique display or exact focus proof',()=>run([
 'header="WINDOW MANAGER DISPLAY CONTENTS (dumpsys window displays)"',
 'd0="Display: mDisplayId=0"',
 'marker="mCurrentFocus=Window{ab12 u0 com.negresco.finance/.MainActivity}"',
 'valid=header+"\\n"+d0+"\\n"+marker',
 'organized=valid.replace(d0,d0+" (organized)")',
 'before=b.NEW.replace(a.OLD,a.NEW)',
 'after=before.replace(m.OLD,m.NEW)',
 'def invoke(code,raw):',
 ' env={"re":re}',
 ' exec(code,env)',
 ' stream=io.StringIO()',
 ' with contextlib.redirect_stdout(stream): result=env["classify_display_focus"](raw)',
 ' return result,stream.getvalue().strip()',
 'assert invoke(before,organized)[0]=="default-display-unconfirmed"',
 'assert invoke(after,organized)==("default-display-app-focus","ENV (LAB): m98-display-shape=organized-default")',
 'for raw in (valid,valid.replace(d0,d0+" rootTasks=1")):',
 ' assert invoke(before,raw)==invoke(after,raw)==("default-display-app-focus","")',
 'for raw in (organized+"\\n"+marker,organized+"\\n"+d0,organized+"\\nDisplay: mDisplayId=1",organized.replace(d0,"Display: mDisplayId=1"),organized.replace(marker,"mCurrentFocus=null"),organized.replace("finance/","finance.fake/"),organized.replace("u0 ","u10 "),organized.replace("(organized)","(organized) extra"),organized.replace("(organized)","(unknown)"),organized.replace(header,""),organized.replace(marker,""),organized.replace("(organized)","rootTasks=1 (organized)"),None,""):',
 ' result,log=invoke(after,raw)',
 ' assert result!="default-display-app-focus" and "com.negresco" not in log'
]));
test('M98 retains API29 success API35 block and production gates',()=>{
 for(const x of ['M97','1,780/1,780','API29 PASS','API35 BLOCK','default-header-format-unconfirmed','no Pix tap','(organized)','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
