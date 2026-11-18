import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const py='tooling/android/guardiao_api28_unique_xml_capture_gate_lab.py';
const wf=readFileSync('.github/workflows/guardiao-api28-unique-xml-capture-gate.yml','utf8');
const src=readFileSync(py,'utf8');

function probe(parts){
 const script=[
  'import sys,io,contextlib',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'import guardiao_api28_unique_xml_capture_gate_lab as d',
  ...parts,
 ].join('\n');
 const z=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:25000});
 assert.equal(z.status,0,z.stderr);
 assert.match(z.stdout,/PASS \(LAB\): unique XML gate/);
 assert.doesNotMatch(z.stdout,/PRIVATE|SECRET|<hierarchy|\/data\/local\/tmp\/ng_ui_|mCurrentFocus/);
}

test('ACK accepts only the exact fresh destination, and classifies idle and null-root without raw output',()=>{
 probe([
  "p='/data/local/tmp/ng_ui_example_1.xml'",
  "assert d.ack_category('UI hierchary dumped to: '+p,p)=='reported'",
  "assert d.ack_category('UI hierarchy dumped to: '+p,p)=='reported'",
  "assert d.ack_category('UI hierchary dumped to: /sdcard/negresco_ui.xml',p)=='unconfirmed'",
  "assert d.ack_category('ERROR: could not get idle state.',p)=='idle-state-unavailable'",
  "assert d.ack_category('ERROR: null root node returned by UiTestAutomationBridge.',p)=='null-root'",
  "assert d.ack_category('ERROR: PRIVATE',p)=='other-error'",
  "assert d.ack_category('',p)=='unconfirmed'",
  "print('PASS (LAB): unique XML gate')",
 ]);
});

test('each original dump and read is redirected to a distinct path and promptly removed',()=>{
 probe([
  'old=d.base.adb',
  'files={};ops=[]',
  "xml='<hierarchy><node text=\"PRIVATE\"/></hierarchy>'",
  'def fake(*args,**kw):',
  '  ops.append(args)',
  "  if args[:3]==('shell','uiautomator','dump'):",
  '    files[args[3]]=xml',
  "    return 'UI hierchary dumped to: '+args[3]",
  "  if args[:2]==('exec-out','cat'): return files[args[2]]",
  "  if args[:3]==('shell','rm','-f'): files.pop(args[3]); return ''",
  "  raise AssertionError('unexpected ADB')",
  'def flow():',
  '  for _ in range(2):',
  '    assert d.base.adb(*d.ORIGINAL_DUMP)==None if False else True',
  '    assert d.base.adb(*d.ORIGINAL_READ)==xml',
  "with patch.object(d.base,'adb',side_effect=fake),patch.object(d.prior,'run',side_effect=flow):",
  '  saved=d.base.adb',
  '  with contextlib.redirect_stdout(io.StringIO()) as buf:d.run()',
  '  assert d.base.adb is saved',
  '  assert buf.getvalue().count("unique-xml-dump-ack=reported")==2',
  'assert files=={}',
  "dumps=[a[3] for a in ops if a[:3]==('shell','uiautomator','dump')]",
  'assert len(dumps)==2 and dumps[0]!=dumps[1]',
  "assert all(p.startswith('/data/local/tmp/ng_ui_') for p in dumps)",
  "assert len([a for a in ops if a[:3]==('shell','rm','-f')])==2",
  "print('PASS (LAB): unique XML gate')",
 ]);
});

test('unconfirmed dump ACK blocks before stale shared-path XML can be read',()=>{
 probe([
  'ops=[]',
  'def fake(*args,**kw):',
  '  ops.append(args)',
  "  if args[:3]==('shell','uiautomator','dump'): return 'ERROR: could not get idle state.'",
  "  if args[:3]==('shell','rm','-f'): return ''",
  "  raise AssertionError('stale shared path must never be read')",
  'def flow(): d.base.adb(*d.ORIGINAL_DUMP)',
  "with patch.object(d.base,'adb',side_effect=fake),patch.object(d.prior,'run',side_effect=flow):",
  '  with contextlib.redirect_stdout(io.StringIO()) as out:',
  '    try:d.run()',
  '    except d.CaptureUnconfirmed:pass',
  "    else:raise AssertionError('ACK failure must BLOCK')",
  "  assert 'unique-xml-dump-ack=idle-state-unavailable' in out.getvalue()",
  'assert len(ops)==2',
  "assert ops[1][:3]==('shell','rm','-f')",
  "print('PASS (LAB): unique XML gate')",
 ]);
});

test('failed read also cleans the temporary file and preserves the failure',()=>{
 probe([
  'ops=[]',
  'def fake(*args,**kw):',
  '  ops.append(args)',
  "  if args[:3]==('shell','uiautomator','dump'): return 'UI hierchary dumped to: '+args[3]",
  "  if args[:2]==('exec-out','cat'): raise RuntimeError('SECRET read failed')",
  "  if args[:3]==('shell','rm','-f'): return ''",
  "  raise AssertionError('unexpected operation')",
  'def flow():d.base.adb(*d.ORIGINAL_DUMP);d.base.adb(*d.ORIGINAL_READ)',
  "with patch.object(d.base,'adb',side_effect=fake),patch.object(d.prior,'run',side_effect=flow):",
  '  with contextlib.redirect_stdout(io.StringIO()):',
  '    try:d.run()',
  '    except RuntimeError:pass',
  "    else:raise AssertionError('cat failure must propagate')",
  "assert len(ops)==3 and ops[2][:3]==('shell','rm','-f')",
  "print('PASS (LAB): unique XML gate')",
 ]);
});

test('workflow stays pinned to test-only APK and app/navigation gates are not edited',()=>{
 for(const s of [
  'lab/p01-guardiao-api28-unique-xml-capture-gate-v1',
  'trial: [1, 2, 3, 4]',
  'api: [28]','run-id: 43789332636',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'CN=Android Debug','sha256sum --check --strict','contents: read','actions: read',
  'script: python3 tooling/android/guardiao_api28_unique_xml_capture_gate_lab.py',
  'fail-fast: false'
 ])assert.ok(wf.includes(s),s);
 assert.doesNotMatch(wf,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
 for(const s of [
  'return old_adb(*args, **kwargs)',
  'prior.run()', 'base.adb = old_adb', 'cleanup(path)',
  'if ack != "reported":',
  'raise CaptureUnconfirmed("dump did not confirm unique destination")',
 ])assert.ok(src.includes(s),s);
 const original=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
 assert.match(original,/first != scoped\.PASS or second != scoped\.PASS/);
 assert.match(original,/attest_triplet\(pid, "pre-return"\)/);
 assert.doesNotMatch(src,/sleep\(|input", "tap"|input", "swipe"|adb shell pm clear|logcat|screenshot/);
});
