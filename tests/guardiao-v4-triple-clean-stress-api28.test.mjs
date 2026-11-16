import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/guardiao-candidate-release-v4-triple-clean-stress-api28.yml','utf8');
const laboratory=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
const fixture=readFileSync('tooling/android/guardiao_candidate_release_root_v4_api28_pdf_lab.py','utf8');

test('P0 stress repeats exact approved v4 test three times with independently clean emulators',()=>{
 assert.match(workflow,/repetition: \[alpha, beta, gamma\]/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/runs-on: ubuntu-22\.04/);
 assert.match(workflow,/reactivecircus\/android-emulator-runner@/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab\.py/);
 assert.match(workflow,/emulator-options: -no-window.*-no-snapshot/);
 assert.match(workflow,/branches:\s*\n\s*- lab\/p01-guardiao-v4-api28-triple-clean-repeat-v1/);
});
test('P0 stress pins candidate identity and preserves immutable Release differentiation',()=>{
 assert.match(workflow,/run-id: 43772274643/);
 assert.match(workflow,/name: negresco-finance-v313-security-preview/);
 assert.match(workflow,/3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6/g);
 assert.match(workflow,/CN=Android Debug/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(fixture,/ORIGINAL_IMMUTABLE = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(fixture,/candidate_identity\(APK\)/);
 assert.match(laboratory,/repeated\.run\(\)/);
 assert.match(laboratory,/attest_triplet\(pid, "initial"\)/);
 assert.match(laboratory,/attest_triplet\(pid, "pre-return"\)/);
 assert.match(laboratory,/attest_triplet\(pid, "post-return"\)/);
 assert.match(laboratory,/if initial_count != 1 or return_count != 3:/);
});
test('no production effects and no weakened gates in stress workflow',()=>{
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/actions: read/);
 assert.doesNotMatch(workflow,/contents: write|workflow_dispatch|pull_request:|schedule:|assembleRelease|assembleDebug|upload-artifact|secrets\.|eas update|npm publish|gh release create/i);
 assert.doesNotMatch(workflow,/continue-on-error: true|\|\| true|fail-fast: true/);
 assert.match(workflow,/build_receiving_apk.sh/);
 assert.match(workflow,/pdftotext/);
 assert.match(workflow,/sha256sum --check --strict/g);
});
