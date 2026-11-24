import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-compat-preflight-m94.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-compat-focus-m95.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_compat_focus_m95.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_COMPAT_FOCUS_M95.md','utf8');
test('M95 exact M94 workflow except names refs and source prep',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug compatibility preflight diagnostics M94","Guardiao Debug compatibility focus diagnostics M95"],["lab/p01-guardiao-debug-compat-preflight-m94-v1","lab/p01-guardiao-debug-compat-focus-m95-v1"],["guardiao-debug-compat-preflight-m94-","guardiao-debug-compat-focus-m95-"],["M94 API ${{ matrix.api }} - preflight checkpoints","M95 API ${{ matrix.api }} - focus diagnostics"],["Apply exact M93 control plus fixed preflight checkpoints","Apply exact M94 control plus fixed focus categories"],["guardiao_debug_compat_preflight_m94.py apply","guardiao_debug_compat_focus_m95.py apply"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-compat-focus-m95-v1"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_ACTIONS") != "true"'));
 assert.ok(patch.includes('os.environ.get("GITHUB_REF") != LAB_REF'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, re, subprocess, io, contextlib',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_compat_focus_m95 as m',
 'import guardiao_debug_compat_preflight_m94 as a',
 "orig=m.OBSERVER.read_text(encoding='utf-8')",
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M95 reversible diagnostic only on both APIs',()=>run([
 'assert m.m91_pure is a.m91_pure',
 'for api in m.APIS:',
 ' control=a.diagnostic_transform(orig,api)',
 ' out=m.focus_transform(orig,api)',
 ' ast.parse(out)',
 ' assert out.count(m.NEW)==1 and out.replace(m.NEW,m.OLD)==control',
 ' assert m.NEW.count("BASE.adb(")==1',
 ' assert m.NEW.count("timeout=22")==1'
]));
test('M95 original focus decisions and command errors preserved with only fixed categories',()=>run([
 'class Fake:',
 ' def __init__(self,raw): self.raw=raw; self.calls=0',
 ' def adb(self,*args,**kwargs):',
 '  self.calls+=1',
 '  assert args==("shell","dumpsys","window","windows") and kwargs=={"timeout":22}',
 '  if isinstance(self.raw,Exception): raise self.raw',
 '  return self.raw',
 'def invoke(code,raw):',
 ' base=Fake(raw)',
 ' env={"BASE":base,"re":re,"subprocess":subprocess}',
 ' exec(code,env)',
 ' stream=io.StringIO()',
 ' with contextlib.redirect_stdout(stream):',
 '  try: result=env["debug_focus"]()',
 '  except Exception as e: result=type(e)',
 ' assert base.calls==1',
 ' return result,stream.getvalue().strip()',
 'cases=[("", "empty-response"),("private fixture", "missing-marker"),("mCurrentFocus=null","null-marker"),("mCurrentFocus=Window{abc u0 com.negresco.finance/.Main}","original-match"),("mCurrentFocus=Window{abc u10 com.negresco.finance/.Main}","app-token-nonmatching"),("mCurrentFocus=Window{abc u0 com.example.fixture/.Main}","nonmatching-marker"),("mCurrentFocus="+"x"*1025,"oversized-marker"),("mCurrentFocus=null\\nmCurrentFocus=Window{abc u0 com.negresco.finance/.Main}","null-marker"),(subprocess.TimeoutExpired("private",22),"command-timeout"),(RuntimeError("private"),"command-error")]',
 'for raw,category in cases:',
 ' before,_=invoke(m.OLD,raw)',
 ' after,log=invoke(m.NEW,raw)',
 ' assert before==after and log=="ENV (LAB): m95-focus="+category'
]));
test('M95 preserves prior evidence and production gates',()=>{
 for(const x of ['M94','1,768/1,768','m94-preflight-next=focus','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
