import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const wf=readFileSync('.github/workflows/guardiao-v5-owned-uri-four-pdf-samepid-cross-api.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_v5_owned_uri_scoped_four_pdf_samepid_cross_api_lab.py','utf8');
const scoped26=readFileSync('tooling/android/guardiao_candidate_release_v4_api26_scoped_four_pdf_samepid_lab.py','utf8');
const scoped28=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
const core26=readFileSync('tooling/android/guardiao_candidate_release_v4_api26_four_pdf_samepid_core_lab.py','utf8');
const core28=readFileSync('tooling/android/guardiao_candidate_release_root_v4_api28_same_pid_lab.py','utf8');
const app=readFileSync('apps/mobile/App.tsx','utf8');

test('v5 four-PDF scoped Android8/9 job pins exact built Debug APK and fresh emulator',()=>{
 assert.match(wf,/name: Guardiao v5 owned PDF URI four PDFs same PID API26 API28/);
 assert.ok(wf.includes('lab/p01-guardiao-v5-owned-uri-four-pdf-samepid-cross-api-v1'));
 assert.match(wf,/run-id: 43789332636/);
 assert.match(wf,/0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4/g);
 assert.match(wf,/name: negresco-finance-v313-security-preview/);
 assert.match(wf,/CN=Android Debug/);
 assert.match(wf,/sha256sum --check --strict/g);
 assert.match(wf,/api: \[26, 28\]/);
 assert.doesNotMatch(wf,/trial: \[/);
 assert.match(wf,/fail-fast: false/);
 assert.match(wf,/api-level: \$\{\{ matrix\.api \}\}/);
 assert.match(wf,/script: python3 tooling\/android\/guardiao_v5_owned_uri_scoped_four_pdf_samepid_cross_api_lab\.py/);
 assert.match(wf,/build_receiving_apk\.sh/);
 assert.match(wf,/pdftotext/);
 assert.match(wf,/persist-credentials: false/);
 assert.match(wf,/contents: read/);
 assert.match(wf,/actions: read/);
 assert.doesNotMatch(wf,/contents: write|continue-on-error: true|\|\| true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|eas update|secrets\./i);
});
test('v5 delegates strict four-PDF same-PID and passive navigation scopes unchanged',()=>{
 assert.match(runner,/NEW_SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"/);
 assert.match(runner,/PREVIOUS_SHA = "3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6"/);
 assert.match(runner,/HISTORICAL_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(runner,/candidate\.PINNED_CANDIDATE = NEW_SHA/);
 assert.match(runner,/candidate\.candidate_identity\(candidate\.APK\)/);
 assert.match(runner,/scoped26\.run\(\)/);
 assert.match(runner,/scoped28\.run\(\)/);
 assert.match(runner,/semantic\.ensure_absent\(\)/);
 assert.match(runner,/api not in \("26", "28"\)/);
 assert.match(runner,/BLOCK \(PRODUCTION\): historical original not reproduced, test APK only/);
 for(const source of [core26,core28]){
  assert.match(source,/CYCLES = \("a", "b", "c", "d"\)/);
  assert.match(source,/home\.observed_single_app_pid\(\) != baseline_pid/);
  assert.match(source,/if not skipped or not home_verified:/);
  assert.match(source,/semantic\.ensure_absent\(\)/);
 }
 for(const source of [scoped26,scoped28]){
  assert.match(source,/attest_triplet\(pid, "initial"\)/);
  assert.match(source,/attest_triplet\(pid, "pre-return"\)/);
  assert.match(source,/attest_triplet\(pid, "post-return"\)/);
  assert.match(source,/if initial_count != 1 or return_count != 3:/);
  assert.match(source,/BASE\.wait_visible = original_wait/);
  assert.match(source,/home\.restore_home_tab_in_same_process = original_restore/);
 }
 assert.match(app,/isOwnedPdfUri:uri=>isOwnedPrintPdfUri\(uri,FileSystem\.cacheDirectory\)/);
 assert.doesNotMatch(runner,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|print\(report\)|print\(raw\)|print\(uri\)/);
});
test('v5 bounded lab refuses runtime parameters and does not print private content',()=>{
 const x=spawnSync('python3',['tooling/android/guardiao_v5_owned_uri_scoped_four_pdf_samepid_cross_api_lab.py','unexpected'],{encoding:'utf8',timeout:20000});
 assert.equal(x.status,1,x.stderr);
 assert.match(x.stderr,/BLOCK \(LAB\): v5 four-PDF same-PID scoped proof incomplete/);
 assert.doesNotMatch(x.stdout+x.stderr,/file:\/\/|data:\/\/|\/data\/user\/|HTML|PDF content/);
});
