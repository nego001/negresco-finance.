import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const src=readFileSync('tooling/android/guardiao_v5_api28_chooser_xml_reuse_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-v5-api28-chooser-xml-reuse.yml','utf8');

function check(lines){
 const code=[
  'import contextlib,io,sys',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'import guardiao_v5_api28_chooser_xml_reuse_lab as d',
  ...lines,
 ].join('\n');
 const run=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:25000});
 assert.equal(run.status,0,run.stderr);
 assert.match(run.stdout,/PASS \(LAB\): chooser xml reuse contract/);
 assert.doesNotMatch(run.stdout,/PRIVATE|SECRET|<hierarchy|mCurrentFocus|sha256:/);
}

test('one owned chooser XML then identical first pre-return XML is labeled, never promoted to PASS',()=>{
 check([
  "raw='<hierarchy><node text=\"PRIVATE-SYNTHETIC-ONLY\"/></hierarchy>'",
  'old_adb=d.base.adb; old_recv=d.base.receive_from_chooser; old_sample=d.prior.sample',
  'events=[]',
  'def fake_adb(*args,**kwargs):',
  '  events.append(args)',
  "  if args==d.DUMP_ARGS: return 'UI hierchary dumped to: /sdcard/negresco_ui.xml'",
  '  if args==d.CAT_ARGS: return raw',
  "  raise AssertionError('unexpected ADB command')",
  'def chooser_flow():',
  '  d.base.adb(*d.DUMP_ARGS)',
  '  d.base.adb(*d.CAT_ARGS)',
  'def flow():',
  '  d.base.receive_from_chooser()',
  "  assert d.prior.sample()=='window-focus-app'",
  '  d.base.adb(*d.DUMP_ARGS)',
  '  d.base.adb(*d.CAT_ARGS)',
  "with patch.object(d.base,'adb',side_effect=fake_adb), patch.object(d.base,'receive_from_chooser',side_effect=chooser_flow),patch.object(d.prior,'sample',return_value='window-focus-app'),patch.object(d.prior,'run',side_effect=flow):",
  '  fake_adb_ref=d.base.adb; recv_ref=d.base.receive_from_chooser; sample_ref=d.prior.sample',
  '  out=io.StringIO()',
  '  with contextlib.redirect_stdout(out):d.run()',
  "  assert out.getvalue().count('pre-return-xml-chooser-equality=byte-identical-to-chooser dump-ack=reported')==1",
  '  assert d.base.adb is fake_adb_ref and d.base.receive_from_chooser is recv_ref and d.prior.sample is sample_ref',
  'assert d.base.adb is old_adb and d.base.receive_from_chooser is old_recv and d.prior.sample is old_sample',
  'assert events==[d.DUMP_ARGS,d.CAT_ARGS,d.DUMP_ARGS,d.CAT_ARGS]',
  "print('PASS (LAB): chooser xml reuse contract')",
 ]);
});

test('a changed first pre-return capture is distinct; no prior chooser remains inconclusive',()=>{
 check([
  "raw1='<hierarchy><node text=\"PRIVATE-A\"/></hierarchy>'",
  "raw2='<hierarchy><node text=\"PRIVATE-B\"/></hierarchy>'",
  'reads=[raw1,raw2,raw2]',
  'def fake_adb(*args,**kwargs):',
  "  if args==d.DUMP_ARGS: return 'UI hierarchy dumped to: /sdcard/negresco_ui.xml'",
  '  if args==d.CAT_ARGS: return reads.pop(0)',
  "  raise AssertionError('unexpected ADB')",
  'def chooser_flow():',
  '  d.base.adb(*d.DUMP_ARGS);d.base.adb(*d.CAT_ARGS)',
  'def flow():',
  "  d.base.receive_from_chooser();d.prior.sample();d.base.adb(*d.DUMP_ARGS);d.base.adb(*d.CAT_ARGS)",
  "  d.prior.sample();d.base.adb(*d.DUMP_ARGS);d.base.adb(*d.CAT_ARGS)",
  "with patch.object(d.base,'adb',side_effect=fake_adb),patch.object(d.base,'receive_from_chooser',side_effect=chooser_flow),patch.object(d.prior,'sample',return_value='window-focus-app'),patch.object(d.prior,'run',side_effect=flow):",
  '  buffer=io.StringIO()',
  '  with contextlib.redirect_stdout(buffer):d.run()',
  "  assert 'different-from-chooser dump-ack=reported' in buffer.getvalue()",
  "  assert 'no-chooser-reference dump-ack=reported' in buffer.getvalue()",
  "print('PASS (LAB): chooser xml reuse contract')",
 ]);
});

test('missing chooser XML, failed dump acknowledgement and invalid raw content remain unconfirmed',()=>{
 check([
  "assert d.dump_ack('UI hierchary dumped to: /sdcard/negresco_ui.xml')=='reported'",
  "assert d.dump_ack('UI hierarchy dumped to: /sdcard/negresco_ui.xml')=='reported'",
  "assert d.dump_ack('PRIVATE whatever')=='unconfirmed'",
  "assert d.dump_ack(None)=='unconfirmed'",
  'assert d.xml_fingerprint(None) is None',
  "assert d.xml_fingerprint('') is None",
  "assert d.xml_fingerprint('A'*2000001) is None",
  "assert d.comparison(None,d.xml_fingerprint('synthetic'))=='no-chooser-reference'",
  "assert d.comparison(d.xml_fingerprint('synthetic'),None)=='current-xml-unconfirmed'",
  "print('PASS (LAB): chooser xml reuse contract')",
 ]);
});

test('downstream BLOCK restores all intercepted functions and never suppresses failure',()=>{
 check([
  'old_adb=d.base.adb;old_recv=d.base.receive_from_chooser;old_sample=d.prior.sample',
  "def fail(): raise RuntimeError('PRIVATE DOWNSTREAM BLOCK')",
  "with patch.object(d.prior,'run',side_effect=fail):",
  '  try:d.run()',
  "  except RuntimeError as e: assert str(e)=='PRIVATE DOWNSTREAM BLOCK'",
  "  else: raise AssertionError('BLOCK must propagate')",
  'assert d.base.adb is old_adb',
  'assert d.base.receive_from_chooser is old_recv',
  'assert d.prior.sample is old_sample',
  "print('PASS (LAB): chooser xml reuse contract')",
 ]);
});

test('workflow keeps exact Android 9 APK and strict four-PDF gate; no new Android reads',()=>{
 for(const s of [
  'lab/p01-guardiao-v5-api28-chooser-xml-reuse-diagnostic-v1',
  'trial: [1, 2, 3, 4, 5, 6, 7, 8]',
  'api: [28]',
  'run-id: 43789332636',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'sha256sum --check --strict',
  'CN=Android Debug',
  'script: python3 tooling/android/guardiao_v5_api28_chooser_xml_reuse_lab.py',
  'contents: read','actions: read','fail-fast: false'
 ]) assert.ok(workflow.includes(s),s);
 assert.doesNotMatch(workflow,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|schedule:|workflow_dispatch:|pull_request:|secrets\./i);
 for(const s of [
  'result = original_adb(*args, **kwargs)',
  'return result',
  'return original_receiver(*args, **kwargs)',
  'return original_sample()',
  'base.adb = original_adb',
  'base.receive_from_chooser = original_receiver',
  'prior.sample = original_sample'
 ]) assert.ok(src.includes(s),s);
 const s=src.slice(src.indexOf('def observed_adb('),src.indexOf('def observed_receiver('));
 assert.doesNotMatch(s,/sleep\(|subprocess|adb\.shell|input.*tap|uiautomator.*dump.*adb\(|print\(result|print\(fingerprint/);
});
