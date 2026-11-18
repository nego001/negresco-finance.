import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const src=readFileSync('tooling/android/guardiao_api28_dump_stream_shapes_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-dump-stream-shapes.yml','utf8');
function probe(lines){
 const script=[
  'import sys,io,contextlib,subprocess',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'from types import SimpleNamespace',
  'import guardiao_api28_dump_stream_shapes_lab as d',
  ...lines
 ].join('\n');
 const res=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:20000});
 assert.equal(res.status,0,res.stderr);
 assert.match(res.stdout,/PASS \(LAB\): dump shape classified/);
 assert.doesNotMatch(res.stdout,/PRIVATE|SECRET|\/data\/local\/tmp\/ng_ui_|<hierarchy|mCurrentFocus|\.MainActivity/);
}
test('fixed categories distinguish exact success from wrong path, extra output, idle and null root',()=>{
 probe([
  "p='/data/local/tmp/ng_ui_synthetic_1.xml'",
  "assert d.stream_shape('UI hierchary dumped to: '+p,p)=='exact-ack'",
  "assert d.stream_shape('warning PRIVATE\\nUI hierchary dumped to: '+p,p)=='ack-with-extra-text'",
  "assert d.stream_shape('UI hierchary dumped to: /other/path.xml',p)=='ack-other-or-no-destination'",
  "assert d.stream_shape('ERROR: could not get idle state',p)=='idle-unavailable'",
  "assert d.stream_shape('ERROR: null root node returned',p)=='null-root'",
  "assert d.stream_shape('permission denied',p)=='permission-denied'",
  "assert d.stream_shape('PRIVATE '+p,p)=='mentions-destination-without-ack'",
  "assert d.stream_shape('PRIVATE text',p)=='other-text'",
  "assert d.stream_shape('',p)=='empty'",
  "assert d.stream_shape(None,p)=='nontext'",
  "print('PASS (LAB): dump shape classified')",
 ]);
});
test('one original subprocess call, stdout and stderr independently classified, result unchanged',()=>{
 probe([
  "path='/data/local/tmp/ng_ui_synthetic_1.xml'",
  "calls=[]",
  'def fake(args,*rest,**kwargs):',
  '  calls.append(tuple(args))',
  "  return SimpleNamespace(returncode=0,stdout='PRIVATE unexpected reply',stderr='ERROR: could not get idle state')",
  'def flow():',
  "  return d.base.adb('shell','uiautomator','dump',path)",
  "with patch.object(subprocess,'run',side_effect=fake) as orig,patch.object(d.prior,'run',side_effect=flow):",
  '  original=subprocess.run',
  '  output=io.StringIO()',
  '  with contextlib.redirect_stdout(output):',
  "    assert d.run() is None",
  '  assert subprocess.run is original',
  '  assert len(calls)==1 and calls[0]==("adb","shell","uiautomator","dump",path)',
  "  assert 'dump-exit=zero stdout=other-text stderr=idle-unavailable' in output.getvalue()",
  "  assert 'PRIVATE' not in output.getvalue()",
  "print('PASS (LAB): dump shape classified')",
 ]);
});
test('other adb commands remain unobserved; nonzero exits and timeouts preserve failure',()=>{
 probe([
  "path='/data/local/tmp/ng_ui_synthetic_2.xml'",
  "calls=[]",
  'def fake(args,*rest,**kwargs):',
  '  calls.append(tuple(args))',
  "  if args[-1]=='size':return SimpleNamespace(returncode=0,stdout='PRIVATE resolution',stderr='')",
  "  if args[-1]==path:return SimpleNamespace(returncode=7,stdout='PRIVATE',stderr='SECRET')",
  "  raise AssertionError('unexpected command')",
  'def flow():',
  "  assert d.base.adb('shell','wm','size')=='PRIVATE resolution'",
  "  d.base.adb('shell','uiautomator','dump',path)",
  "with patch.object(subprocess,'run',side_effect=fake),patch.object(d.prior,'run',side_effect=flow):",
  '  buffer=io.StringIO()',
  '  try:',
  '    with contextlib.redirect_stdout(buffer):d.run()',
  '  except RuntimeError:pass',
  "  else:raise AssertionError('original nonzero behavior lost')",
  '  assert len(calls)==2',
  "  assert buffer.getvalue().count('dump-exit=nonzero stdout=other-text stderr=other-text')==1",
  'def timeout(args,*rest,**kwargs):',
  "  raise subprocess.TimeoutExpired(args,35)",
  "with patch.object(subprocess,'run',side_effect=timeout),patch.object(d.prior,'run',side_effect=lambda:d.base.adb('shell','uiautomator','dump',path)):",
  '  buffer=io.StringIO()',
  '  try:',
  '    with contextlib.redirect_stdout(buffer):d.run()',
  '  except subprocess.TimeoutExpired:pass',
  "  else:raise AssertionError('timeout should propagate')",
  "  assert 'dump-exit=timeout' in buffer.getvalue()",
  "print('PASS (LAB): dump shape classified')",
 ]);
});
test('only pinned API28 read-only emulators and original strict gate execute',()=>{
 for(const s of [
  'lab/p01-guardiao-api28-dump-stream-shapes-v1',
  'trial: [1, 2, 3]',
  'api: [28]','run-id: 43789332636',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'CN=Android Debug','sha256sum --check --strict','contents: read','actions: read',
  'script: python3 tooling/android/guardiao_api28_dump_stream_shapes_lab.py',
  'fail-fast: false'
 ])assert.ok(workflow.includes(s),s);
 assert.doesNotMatch(workflow,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
 for(const s of ['completed = original_subprocess_run(args, *rest, **kwargs)',
   'return completed','prior.run()','subprocess.run = original_subprocess_run',
   'stream_shape(getattr(completed, "stdout", None), args[4])',
   'stream_shape(getattr(completed, "stderr", None), args[4])'
 ])assert.ok(src.includes(s),s);
 const gate=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
 assert.match(gate,/first != scoped\.PASS or second != scoped\.PASS/);
 assert.match(gate,/attest_triplet\(pid, "pre-return"\)/);
 assert.doesNotMatch(src,/input", "tap"|input", "swipe"|sleep\(|force-stop|print\(completed|print\(args|print\(value/);
});
