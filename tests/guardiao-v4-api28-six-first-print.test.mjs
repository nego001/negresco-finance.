import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/guardiao-v4-api28-six-independent-first-print.yml','utf8');
const candidate=readFileSync('tooling/android/guardiao_candidate_release_root_v4_api28_pdf_lab.py','utf8');
const replay=readFileSync('tooling/android/guardiao_original_release_input_replay_lab.py','utf8');
const semantic=readFileSync('tooling/android/guardiao_android_export_pdf_text_emulator_smoke.py','utf8');

test('each of six Android9 first PDF trials gets isolated fresh emulator and exact APK',()=>{
 assert.match(workflow,/name: Guardiao Android v4 six independent cold API28 first PDF/);
 assert.match(workflow,/trial: \[1, 2, 3, 4, 5, 6\]/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/runs-on: ubuntu-22\.04/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/reactivecircus\/android-emulator-runner@/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_candidate_release_root_v4_api28_pdf_lab\.py/);
 assert.match(workflow,/emulator-options: -no-window .* -no-snapshot /);
 assert.match(workflow,/branches:\s*\n\s*- lab\/p01-guardiao-v4-api28-six-clean-first-print-v1/);
 assert.match(workflow,/run-id: 43772274643/);
 assert.match(workflow,/name: negresco-finance-v313-security-preview/);
 assert.match(workflow,/3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6/g);
 assert.match(workflow,/CN=Android Debug/);
 assert.match(workflow,/sha256sum --check --strict/g);
});
test('cold first PDF keeps semantic receiver and fails closed, with no app rebuild',()=>{
 assert.match(candidate,/PINNED_CANDIDATE = "3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6"/);
 assert.match(candidate,/ORIGINAL_IMMUTABLE = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(candidate,/candidate_identity\(APK\)/);
 assert.match(candidate,/replay\.run\(\)/);
 assert.match(candidate,/candidate_receipt\(report\)/);
 assert.match(candidate,/semantic\.ensure_absent\(\)/);
 assert.match(replay,/lab\.run_lab\(\)/);
 assert.match(semantic,/base\.run_smoke\(/);
 assert.match(semantic,/after_verified_receipt=inspect_real_android_pdf/);
 assert.match(semantic,/remove_private_capture\(\)/);
 assert.match(workflow,/build_receiving_apk\.sh/);
 assert.match(workflow,/pdftotext/);
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/actions: read/);
 assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/contents: write|fail-fast: true|continue-on-error: true|\|\| true|workflow_dispatch:|pull_request:|schedule:|assembleRelease|assembleDebug|upload-artifact|eas update|gh release create|secrets\./i);
});
test('six first-PDF cold starts are not six uses of the same emulator instance',()=>{
 const executions=(workflow.match(/script:\s*python3 tooling\/android\/guardiao_candidate_release_root_v4_api28_pdf_lab\.py/g)||[]).length;
 assert.equal(executions,1,'matrix must drive six independent emulator jobs from one declarative command');
 assert.doesNotMatch(workflow,/for\s+trial|for\s+i\s+in|adb\s+shell\s+pm\s+clear|adb\s+install\s+-r\s+\$\{\{/i);
});
