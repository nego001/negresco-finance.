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
 'home.restore_home_tab_in_same_process = original_home']){
  assert.ok(py.includes(term),term);
 }
 assert.doesNotMatch(py,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|print\(nodes\)|print\(err\)|print\(expected_pid\)|print\(raw\)/);
});
test('CLI refuses optional input before any emulator action',()=>{
 const p=spawnSync('python3',['tooling/android/guardiao_v5_api28_scoped_home_failure_diagnostic_lab.py','unexpected'],{encoding:'utf8',timeout:14000});
 assert.equal(p.status,1,p.stderr);
 assert.ok(p.stderr.includes('BLOCK (LAB): API28 scoped boundary diagnosis incomplete'));
 assert.doesNotMatch(p.stdout+p.stderr,/file:\/\/|\/data\/user\/|\d{48}/);
});
