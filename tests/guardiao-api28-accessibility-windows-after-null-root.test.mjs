import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const path='tooling/android/guardiao_api28_accessibility_windows_after_null_root_lab.py';
const src=readFileSync(path,'utf8');
const wf=readFileSync('.github/workflows/guardiao-api28-accessibility-windows-after-null-root.yml','utf8');

function python(lines){
 const program=[
  'import sys,io,contextlib',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'import guardiao_api28_accessibility_windows_after_null_root_lab as d',
  ...lines
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): post-null-root accessibility census/);
 assert.doesNotMatch(r.stdout,/PRIVATE|SECRET|Window\[|mCurrentFocus|\/data\/|com\.negresco/);
}

test('Pie accessibility dump with window records is a bounded category, never an identity',()=>{
 python([
  "header='ACCESSIBILITY MANAGER (dumpsys accessibility)\\n'",
  "assert d.category(header+'Window[PRIVATE WINDOW DATA]\\n')=='accessibility-windows-listed'",
  "assert d.category(header+'  Window[PRIVATE APP]\\n  Window[PRIVATE OTHER]\\n')=='accessibility-windows-listed'",
  "assert d.category(header+'User state[attributes:{id=0}\\n')=='accessibility-windows-not-listed'",
  "assert d.category('permission denial PRIVATE')==d.WINDOWS_UNCONFIRMED",
  "assert d.category(None)==d.WINDOWS_UNCONFIRMED",
  "assert d.category('')==d.WINDOWS_UNCONFIRMED",
  "assert d.category(header+'Window[PRIVATE]\\n'*33)==d.WINDOWS_UNCONFIRMED",
  "assert d.category(header+'X'*512001)==d.WINDOWS_UNCONFIRMED",
  "print('PASS (LAB): post-null-root accessibility census')",
 ]);
});
test('one bounded accessibility read follows null-root focus and preserves focus verdict',()=>{
 python([
  'calls=[]',
  "def fake_adb(*args,**kw):",
  '  calls.append((args,kw))',
  "  assert args==('shell','dumpsys','accessibility')",
  "  assert kw=={'timeout':8,'check':False}",
  "  return 'ACCESSIBILITY MANAGER (dumpsys accessibility)\\nWindow[SECRET]\\n'",
  'def flow():',
  "  assert d.root.focus_after_error()=='window-focus-app'",
  "  assert d.root.focus_after_error()=='window-focus-app'",
  "with patch.object(d.base,'adb',side_effect=fake_adb),patch.object(d.root,'focus_after_error',return_value='window-focus-app'),patch.object(d.root,'run',side_effect=flow):",
  '  saved=d.root.focus_after_error',
  '  buffer=io.StringIO()',
  '  with contextlib.redirect_stdout(buffer):d.run()',
  '  assert d.root.focus_after_error is saved',
  '  assert len(calls)==1',
  "  assert buffer.getvalue().count('post-null-root-a11y-windows=accessibility-windows-listed')==1",
  "  assert 'SECRET' not in buffer.getvalue()",
  "print('PASS (LAB): post-null-root accessibility census')",
 ]);
});
test('normal flow makes no additional adb request and restores the original observer',()=>{
 python([
  'original=d.root.focus_after_error',
  "with patch.object(d.base,'adb',side_effect=AssertionError('no ADB expected')) as adb,patch.object(d.root,'run',return_value=None):",
  '  saved=d.root.focus_after_error',
  '  d.run()',
  '  assert d.root.focus_after_error is saved',
  '  assert adb.call_count==0',
  'assert d.root.focus_after_error is original',
  "print('PASS (LAB): post-null-root accessibility census')",
 ]);
});
test('dumpsys failure is unconfirmed, never leaked or promoted to a navigation PASS',()=>{
 python([
  "with patch.object(d.base,'adb',side_effect=RuntimeError('PRIVATE ERROR')) as adb:",
  "  assert d.sample()==d.WINDOWS_UNCONFIRMED",
  '  assert adb.call_count==1',
  "with patch.object(d.base,'adb',return_value='ACCESSIBILITY MANAGER (dumpsys accessibility)\\n') as adb:",
  "  assert d.sample()=='accessibility-windows-not-listed'",
  '  assert adb.call_count==1',
  "print('PASS (LAB): post-null-root accessibility census')",
 ]);
});
test('source and workflow retain exact test-only APK and original strict two-snapshot gate',()=>{
 for(const key of [
  'lab/p01-guardiao-api28-accessibility-windows-after-null-root-v1',
  'trial: [1, 2]','api: [28]', 'run-id: 43789332636',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'CN=Android Debug','sha256sum --check --strict',
  'script: python3 tooling/android/guardiao_api28_accessibility_windows_after_null_root_lab.py',
  'contents: read','actions: read','fail-fast: false'
 ])assert.ok(wf.includes(key),key);
 assert.doesNotMatch(wf,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|schedule:|workflow_dispatch:|pull_request:|secrets\./i);
 for(const key of [
  'focus = original_focus()', 'return focus', 'root.run()',
  'root.focus_after_error = original_focus',
  'timeout=8, check=False',
  'ACCESSIBILITY MANAGER (dumpsys accessibility)'
 ])assert.ok(src.includes(key),key);
 const gate=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
 assert.match(gate,/first != scoped\.PASS or second != scoped\.PASS/);
 assert.match(gate,/attest_triplet\(pid, "pre-return"\)/);
 assert.doesNotMatch(src,/sleep\(|uiautomator.*dump|input", "tap"|input", "swipe"|print\(raw|print\(args|print\(focus|logcat|screencap/);
});
