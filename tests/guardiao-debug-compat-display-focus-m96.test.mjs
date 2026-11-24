import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-compat-focus-m95.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-compat-display-focus-m96.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_compat_display_focus_m96.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_COMPAT_DISPLAY_FOCUS_M96.md','utf8');
test('M96 exact M95 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug compatibility focus diagnostics M95","Guardiao Debug compatibility display focus M96"],["lab/p01-guardiao-debug-compat-focus-m95-v1","lab/p01-guardiao-debug-compat-display-focus-m96-v1"],["guardiao-debug-compat-focus-m95-","guardiao-debug-compat-display-focus-m96-"],["M95 API ${{ matrix.api }} - focus diagnostics","M96 API ${{ matrix.api }} - display focus"],["Apply exact M94 control plus fixed focus categories","Apply exact M95 control plus strict single display focus"],["guardiao_debug_compat_focus_m95.py apply","guardiao_debug_compat_display_focus_m96.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-compat-display-focus-m96-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, re, subprocess, io, contextlib',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_compat_display_focus_m96 as m',
 'import guardiao_debug_compat_focus_m95 as a',
 "orig=m.OBSERVER.read_text(encoding='utf-8')",
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M96 reversible helper-only change and one read on exact allowed APIs',()=>run([
 'assert m.m91_pure is a.m91_pure',
 'for api in m.APIS:',
 ' control=a.focus_transform(orig,api)',
 ' out=m.display_transform(orig,api)',
 ' ast.parse(out)',
 ' assert out.count(m.NEW)==1 and out.replace(m.NEW,m.OLD)==control',
 ' assert m.NEW.count("BASE.adb(")==1',
 ' assert m.NEW.count("timeout=22")==1',
 "for api in ('28','34','36',None,29,True):",
 " try: m.display_transform(orig,api); raise AssertionError('must reject')",
 ' except RuntimeError: pass'
]));
test('M96 focus parser rejects ambiguity foreign packages null malformed and command failure',()=>run([
 'header="WINDOW MANAGER DISPLAY CONTENTS (dumpsys window displays)"',
 'd0="Display: mDisplayId=0"',
 'marker="mCurrentFocus=Window{ab12 u0 com.negresco.finance/.MainActivity}"',
 'valid=header+"\\n "+d0+"\\n "+marker',
 'class Fake:',
 ' def __init__(self,raw): self.raw=raw; self.calls=0',
 ' def adb(self,*args,**kwargs):',
 '  self.calls+=1',
 '  assert args==("shell","dumpsys","window","displays") and kwargs=={"timeout":22}',
 '  if isinstance(self.raw,Exception): raise self.raw',
 '  return self.raw',
 'def invoke(raw):',
 ' base=Fake(raw)',
 ' env={"BASE":base,"re":re,"subprocess":subprocess}',
 ' exec(m.NEW,env)',
 ' stream=io.StringIO()',
 ' with contextlib.redirect_stdout(stream):',
 '  try: result=env["debug_focus"]()',
 '  except Exception as e: result=type(e)',
 ' assert base.calls==1',
 ' return result,stream.getvalue().strip()',
 'for raw in (valid,valid.replace(d0,d0+" rootTasks=2")):',
 ' assert invoke(raw)==(True,"ENV (LAB): m96-focus=default-display-app-focus")',
 'for raw in (None,"",valid.replace(header,""),valid.replace(d0,"Display: mDisplayId=1"),valid+"\\nDisplay: mDisplayId=1",valid+"\\n"+marker,valid.replace(marker,"mCurrentFocus=null"),valid.replace("u0 ","u10 "),valid.replace("finance/","finance.fake/"),valid.replace("Window{","Other{"),valid+" trailing",valid.replace(marker,"mLastFocus="+marker),header+"\\n"+marker+"\\n"+d0,valid+"x"*2000001):',
 ' result,log=invoke(raw)',
 ' assert result is False and log.startswith("ENV (LAB): m96-focus=") and "com.negresco" not in log',
 'for exc,category in ((subprocess.TimeoutExpired("private",22),"command-timeout"),(RuntimeError("private"),"command-error")):',
 ' assert invoke(exc)==(type(exc),"ENV (LAB): m96-focus="+category)'
]));
test('M96 preserves original failures and production gates',()=>{
 for(const x of ['M95','1,772/1,772','missing-marker','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
