import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const wf=readFileSync('.github/workflows/guardiao-v5-api28-scoped-home-failure-diagnostic.yml','utf8');
const py=readFileSync('tooling/android/guardiao_v5_api28_scoped_home_failure_diagnostic_lab.py','utf8');

test('fixed SHA, 2 clean API28 emulators and no Release or recompile',()=>{
 for(const term of ['lab/p01-guardiao-v5-api28-scoped-home-failure-diagnostic-v1','api: [28]','trial: [1, 2]',
   'fail-fast: false','run-id: 43789332636',
   '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
   'CN=Android Debug','sha256sum --check --strict','api-level: ${{ matrix.api }}',
   'script: python3 tooling/android/guardiao_v5_api28_scoped_home_failure_diagnostic_lab.py','contents: read','actions: read',
   'persist-credentials: false','build_receiving_apk.sh','pdftotext']){
  assert.ok(wf.includes(term),term);
 }
 assert.doesNotMatch(wf,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|eas update|secrets\./i);
});
test('diagnostic instrumentation preserves all original gates and restores hooks',()=>{
 for(const term of ['original_attest = scoped.attest_triplet',
 'original_home = home.restore_home_tab_in_same_process',
 'original_scoped = geometry.scoped_triplet_category',
 'verdict = original_scoped(nodes, width, height)','return verdict',
 'return original_attest(expected_pid, stage)',
 'return original_home(expected_pid)',
 'home.safe_home_block_category(err)','v5.run()',
 'geometry.scoped_triplet_category = original_scoped',
 'scoped.attest_triplet = original_attest',
 'home.restore_home_tab_in_same_process = original_home',
 'original_home_snapshot = home.safe_home_layout_snapshot_category',
 'original_verdict = original_home_snapshot(nodes, width, height)',
 'home.safe_initial_home_detail(',
 'return original_verdict',
 'home.safe_home_layout_snapshot_category = diagnostic_home_snapshot',
 'home.safe_home_layout_snapshot_category = original_home_snapshot']){
  assert.ok(py.includes(term),term);
 }
 assert.doesNotMatch(py,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|print\(nodes\)|print\(err\)|print\(expected_pid\)|print\(raw\)/);
});
test('safe snapshot categories never return private text or untrusted labels',()=>{
 const src=[
 "import sys",
 "sys.path.insert(0, 'tooling/android')",
 "import guardiao_v5_api28_scoped_home_failure_diagnostic_lab as d",
 "assert d.safe_code('home-not-bounded') == 'home-not-bounded'",
 "assert d.safe_code('PRIVATE URI') == 'unknown-or-untrusted'",
 "assert 'home-label-bounded' in d.HOME_CODES",
 "assert 'point-only' in d.LABEL_CODES",
 "assert 'geometry-eligible' in d.ANCESTOR_CODES",
 "assert 'siblings-both-regular' in d.SIBLING_CODES",
 "print('PASS (LAB): safe diagnostic code allowlists')"
 ].join(';');
 const p=spawnSync('python3',['-c',src],{encoding:'utf8',timeout:15000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS \(LAB\): safe diagnostic code allowlists/);
 assert.doesNotMatch(p.stdout,/PRIVATE|file:\/\/|\/data\/user\/|\d{48}/);
});
test('same private snapshot is reused for shape, ancestor, siblings without altering original verdict',()=>{
 assert.match(py,/original_verdict = original_home_snapshot\(nodes, width, height\)/);
 assert.match(py,/shape, ancestor, siblings = home\.safe_initial_home_detail\(\s*nodes, width, height/);
 assert.match(py,/return original_verdict/);
 assert.match(py,/finally:/);
 const start=py.indexOf('    def diagnostic_home_snapshot(');
 const end=py.indexOf('    def diagnostic_category(',start);
 const excerpt=py.slice(start,end);
 assert.doesNotMatch(excerpt,/\.xml_nodes\(|\.adb\(|\.sleep\(|input", "tap"|input", "swipe"|time\.sleep/);
 assert.doesNotMatch(excerpt,/print\(nodes\)|print\(shape\)|print\(ancestor\)|print\(siblings\)/);
});

test('CLI refuses optional input before any emulator action',()=>{
 const p=spawnSync('python3',['tooling/android/guardiao_v5_api28_scoped_home_failure_diagnostic_lab.py','unexpected'],{encoding:'utf8',timeout:14000});
 assert.equal(p.status,1,p.stderr);
 assert.ok(p.stderr.includes('BLOCK (LAB): API28 scoped boundary diagnosis incomplete'));
 assert.doesNotMatch(p.stdout+p.stderr,/file:\/\/|\/data\/user\/|\d{48}/);
});
