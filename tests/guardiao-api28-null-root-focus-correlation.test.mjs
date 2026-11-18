import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const filename='tooling/android/guardiao_api28_null_root_focus_correlation_lab.py';
const src=readFileSync(filename,'utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-null-root-focus-correlation.yml','utf8');

function probe(lines){
 const py=[
  'import sys,io,contextlib,subprocess',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'from types import SimpleNamespace',
  'import guardiao_api28_null_root_focus_correlation_lab as d',
  ...lines
 ].join('\n');
 const res=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(res.status,0,res.stderr);
 assert.match(res.stdout,/PASS \(LAB\): null-root focus remains diagnostic/);
 assert.doesNotMatch(res.stdout,/PRIVATE|SECRET|mCurrentFocus|\.MainActivity|\/data\/local\/tmp\/ng_ui_/);
}

test('zero exit, empty stdout, null-root stderr triggers one focus query after dump',()=>{
 probe([
  "path='/data/local/tmp/ng_ui_fixture_1.xml'",
  'calls=[]',
  'def fake(args,*rest,**kwargs):',
  '  calls.append(tuple(args))',
  "  if tuple(args)==('adb','shell','uiautomator','dump',path):",
  "    return SimpleNamespace(returncode=0,stdout='',stderr='ERROR: null root node returned by UiTestAutomationBridge.')",
  "  if tuple(args)==('adb','shell','dumpsys','window','windows'):",
  "    return SimpleNamespace(returncode=0,stdout='mCurrentFocus=Window{abc u0 com.negresco.finance/.MainActivity}',stderr='SECRET')",
  "  raise AssertionError('unexpected command')",
  'def flow():',
  "  assert d.base.adb('shell','uiautomator','dump',path,timeout=35)==''",
  "with patch.object(subprocess,'run',side_effect=fake),patch.object(d.prior,'run',side_effect=flow):",
  '  original=subprocess.run',
  '  out=io.StringIO()',
  '  with contextlib.redirect_stdout(out):d.run()',
  '  assert subprocess.run is original',
  '  assert len(calls)==2',
  "  assert calls[0]==('adb','shell','uiautomator','dump',path)",
  "  assert calls[1]==('adb','shell','dumpsys','window','windows')",
  "  assert out.getvalue().count('null-root-focus-after-dump=window-focus-app')==1",
  "  assert 'SECRET' not in out.getvalue()",
  "print('PASS (LAB): null-root focus remains diagnostic')",
 ]);
});

test('successful dump or unrelated calls cause zero additional focus queries',()=>{
 probe([
  "path='/data/local/tmp/ng_ui_fixture_2.xml'",
  'calls=[]',
  'def fake(args,*rest,**kwargs):',
  '  calls.append(tuple(args))',
  "  if args[-1]=='size':return SimpleNamespace(returncode=0,stdout='PRIVATE display',stderr='')",
  "  return SimpleNamespace(returncode=0,stdout='UI hierchary dumped to: '+path,stderr='')",
  'def flow():',
  "  assert d.base.adb('shell','wm','size')=='PRIVATE display'",
  "  assert d.base.adb('shell','uiautomator','dump',path).startswith('UI hier')",
  "with patch.object(subprocess,'run',side_effect=fake),patch.object(d.prior,'run',side_effect=flow):",
  '  o=io.StringIO()',
  '  with contextlib.redirect_stdout(o):d.run()',
  "  assert 'null-root-focus-after-dump=' not in o.getvalue()",
  '  assert len(calls)==2',
  "print('PASS (LAB): null-root focus remains diagnostic')",
 ]);
});

test('null-root with focus query failure is inconclusive, not a PASS or retry',()=>{
 probe([
  "path='/data/local/tmp/ng_ui_fixture_3.xml'",
  'calls=[]',
  'def fake(args,*rest,**kwargs):',
  '  calls.append(tuple(args))',
  "  if tuple(args[:4])==('adb','shell','uiautomator','dump'):",
  "    return SimpleNamespace(returncode=0,stdout='',stderr='ERROR: null root node returned')",
  "  if tuple(args[:4])==('adb','shell','dumpsys','window'):raise RuntimeError('PRIVATE failure')",
  "  raise AssertionError('unexpected call')",
  'def flow():',
  "  assert d.base.adb('shell','uiautomator','dump',path)==''",
  "with patch.object(subprocess,'run',side_effect=fake),patch.object(d.prior,'run',side_effect=flow):",
  '  o=io.StringIO()',
  '  with contextlib.redirect_stdout(o):d.run()',
  "  assert 'null-root-focus-after-dump=window-focus-unconfirmed' in o.getvalue()",
  '  assert len(calls)==2',
  "print('PASS (LAB): null-root focus remains diagnostic')",
 ]);
});

test('a null-root result cannot become a valid ACK or loosen the original gate',()=>{
 probe([
  "args=('adb','shell','uiautomator','dump','/data/local/tmp/ng_ui_fixture_4.xml')",
  "result=SimpleNamespace(returncode=0,stdout='',stderr='ERROR: null root node returned')",
  'assert d.is_null_root(args,result)',
  "assert not d.is_null_root(args,SimpleNamespace(returncode=1,stdout='',stderr='ERROR: null root node returned'))",
  "assert not d.is_null_root(args,SimpleNamespace(returncode=0,stdout='UI hierarchy dumped to: fixture',stderr='ERROR: null root node returned'))",
  "assert not d.is_null_root(('adb','shell','wm','size'),result)",
  "assert d.prior.prior.ack_category('',args[-1])=='unconfirmed'",
  "print('PASS (LAB): null-root focus remains diagnostic')",
 ]);
 const gate=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
 assert.match(gate,/first != scoped\.PASS or second != scoped\.PASS/);
 assert.match(gate,/attest_triplet\(pid, "pre-return"\)/);
});

test('workflow pins immutable Debug-only APK and three disposable Android9 trials',()=>{
 for(const text of [
  'lab/p01-guardiao-api28-null-root-focus-correlation-v1',
  'trial: [1, 2, 3]','api: [28]',
  'run-id: 43789332636',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'sha256sum --check --strict','CN=Android Debug',
  'script: python3 tooling/android/guardiao_api28_null_root_focus_correlation_lab.py',
  'contents: read','actions: read','fail-fast: false'
 ])assert.ok(workflow.includes(text),text);
 assert.doesNotMatch(workflow,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|schedule:|workflow_dispatch:|pull_request:|secrets\./i);
 for(const literal of [
  'result = original_run(args, *rest, **kwargs)',
  'return result','prior.run()','subprocess.run = original_run',
  'if is_null_root(args, result):','timeout=8, check=False'
 ])assert.ok(src.includes(literal),literal);
 assert.doesNotMatch(src,/sleep\(|input", "tap"|input", "swipe"|print\(raw|print\(result|print\(args|logcat|screencap/);
});
