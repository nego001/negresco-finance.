import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const w=readFileSync('.github/workflows/guardiao-v5-api28-pre-snapshot-focus.yml','utf8');
const src=readFileSync('tooling/android/guardiao_v5_api28_pre_snapshot_focus_lab.py','utf8');

function probe(lines){
 const cmd=[
  'import sys,io,contextlib',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'import guardiao_v5_api28_pre_snapshot_focus_lab as d',
  ...lines,
 ].join('\n');
 const p=spawnSync('python3',['-c',cmd],{encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS \(LAB\): pre-snapshot probe contract/);
 return p.stdout;
}
test('pinned Android9 eight-trial lab, read-only permissions, unchanged APK',()=>{
 for(const key of [
 'lab/p01-guardiao-v5-api28-pre-snapshot-focus-v1','trial: [1, 2, 3, 4, 5, 6, 7, 8]',
 'api: [28]','run-id: 43789332636','fail-fast: false',
 '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
 'CN=Android Debug','sha256sum --check --strict',
 'script: python3 tooling/android/guardiao_v5_api28_pre_snapshot_focus_lab.py',
 '-no-snapshot','persist-credentials: false','contents: read','actions: read'
 ])assert.ok(w.includes(key),key);
 assert.doesNotMatch(w,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
});
test('at most one additional read exactly before first pre-return UI snapshot, never on initial/post-return',()=>{
 const output=probe([
  'original=d.scoped.attest_triplet',
  'original_xml=d.scoped.BASE.xml_nodes',
  'events=[]',
  'def fake_attest(pid,stage):',
  '  for i in range(2):',
  '    d.scoped.BASE.xml_nodes()',
  '    events.append(stage)',
  'def fake_xml():',
  "  events.append('xml')",
  '  return []',
  'def fake_adb(*args,**kwargs):',
  "  assert args==('shell','dumpsys','window','windows') and kwargs=={'timeout':8,'check':False}",
  "  events.append('focus')",
  "  return 'mCurrentFocus=Window{abc u0 android/com.android.internal.app.ResolverActivity}'",
  'def flow():',
  '  for stage in ("initial","pre-return","post-return"): d.scoped.attest_triplet("900",stage)',
  "with patch.object(d.scoped,'attest_triplet',side_effect=fake_attest),patch.object(d.scoped.BASE,'xml_nodes',side_effect=fake_xml),patch.object(d.home.base,'adb',side_effect=fake_adb) as adb,patch.object(d.prior,'run',side_effect=flow):",
  '  with contextlib.redirect_stdout(io.StringIO()) as out: d.run()',
  "  assert events==['xml','initial','xml','initial','focus','xml','pre-return','xml','pre-return','xml','post-return','xml','post-return']",
  '  assert adb.call_count==1',
  "  assert out.getvalue().count('focus-before-first-pre-return-snapshot=window-focus-chooser')==1",
  'assert d.scoped.attest_triplet is original',
  'assert d.scoped.BASE.xml_nodes is original_xml',
  "print('PASS (LAB): pre-snapshot probe contract')"
 ]);
 assert.doesNotMatch(output,/mCurrentFocus|ResolverActivity/);
});
test('failure restores patches, focus error is unconfirmed and never grants pass',()=>{
 probe([
  'old_attest=d.scoped.attest_triplet; old_xml=d.scoped.BASE.xml_nodes',
  'def fail(pid,stage):',
  '  d.scoped.BASE.xml_nodes()',
  "  raise RuntimeError('synthetic-block')",
  'def flow(): d.scoped.attest_triplet("900","pre-return")',
  "with patch.object(d.scoped,'attest_triplet',side_effect=fail) as patched_attest,patch.object(d.scoped.BASE,'xml_nodes',return_value=[]) as xml,patch.object(d.home.base,'adb',side_effect=RuntimeError('private-data')) as adb,patch.object(d.prior,'run',side_effect=flow):",
  '  inner=d.scoped.attest_triplet; inner_xml=d.scoped.BASE.xml_nodes',
  '  captured=io.StringIO()',
  '  try:',
  '    with contextlib.redirect_stdout(captured): d.run()',
  '  except RuntimeError: pass',
  "  else: raise AssertionError('must propagate block')",
  '  assert d.scoped.attest_triplet is inner and d.scoped.BASE.xml_nodes is inner_xml',
  '  assert adb.call_count==1 and xml.call_count==1',
  "  assert 'focus-before-first-pre-return-snapshot=window-focus-unconfirmed' in captured.getvalue()",
  "  assert 'private-data' not in captured.getvalue()",
  'assert d.scoped.attest_triplet is old_attest and d.scoped.BASE.xml_nodes is old_xml',
  "print('PASS (LAB): pre-snapshot probe contract')"
 ]);
});
test('the added focus observation never edits accepted geometry, inputs, sleeps or retry counts',()=>{
 for(const key of [
  'return old_attest(pid, stage)', 'return old_xml(*args, **kwargs)',
  'scoped.attest_triplet = old_attest', 'scoped.BASE.xml_nodes = old_xml',
  'pending_first = False', 'active = stage == "pre-return"'
 ]) assert.ok(src.includes(key),key);
 const i=src.indexOf('def sample('),j=src.indexOf('\ndef run(',i);
 assert.ok(j>i);
 assert.match(src.slice(i,j),/timeout=8, check=False/);
 assert.doesNotMatch(src,/sleep\(|input", "tap"|input", "swipe"|force-stop|\\.install\\(|uiautomator|logcat|screenshot/);
});
