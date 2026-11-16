import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const core=readFileSync('tooling/android/guardiao_candidate_release_v4_api26_four_pdf_samepid_core_lab.py','utf8');
const scope=readFileSync('tooling/android/guardiao_candidate_release_v4_api26_scoped_four_pdf_samepid_lab.py','utf8');
const wf=readFileSync('.github/workflows/guardiao-candidate-release-v4-api26-scoped-four-pdf.yml','utf8');

test('API26 four-PDF replay pins candidate and only adapts API from existing v4',()=>{
 assert.match(wf,/run-id: 43772274643/);
 assert.match(wf,/3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6/g);
 assert.match(wf,/CN=Android Debug/);
 assert.match(wf,/api-level: 26/);
 assert.match(wf,/scenario: \[same_pid\]/);
 assert.match(wf,/build_receiving_apk\.sh/);
 assert.match(wf,/pdftotext/);
 assert.match(wf,/persist-credentials: false/);
 assert.match(wf,/sha256sum --check --strict/g);
 assert.match(wf,/contents: read/);
 assert.doesNotMatch(wf,/contents: write|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch|eas update|continue-on-error: true|secrets\./i);
 assert.match(core,/CYCLES = \("a", "b", "c", "d"\)/);
 assert.match(core,/api26\.run\(\)/);
 assert.match(core,/strip\(\) != "26"/);
 assert.match(core,/home\.observed_single_app_pid\(\) != baseline_pid/);
 assert.match(core,/if not skipped or not home_verified:/);
 assert.match(core,/if semantic\.REPORT\.exists\(\) or BASE\.REPORT\.exists\(\):/);
 assert.match(core,/semantic\.ensure_absent\(\)/);
});
test('API26 scoped wrapper checks each Home transition and restores wrappers',()=>{
 assert.match(scope,/repeated\.run\(\)/);
 assert.match(scope,/attest_triplet\(pid, "initial"\)/);
 assert.match(scope,/attest_triplet\(pid, "pre-return"\)/);
 assert.match(scope,/attest_triplet\(pid, "post-return"\)/);
 assert.match(scope,/if initial_count != 1 or return_count != 3:/);
 assert.match(scope,/original_restore\(pid\)/);
 assert.match(scope,/BASE\.wait_visible = original_wait/);
 assert.match(scope,/home\.restore_home_tab_in_same_process = original_restore/);
 assert.match(scope,/strip\(\) != "26"/);
 const raw=[core,scope].map(s=>s.replace(/"""[\s\S]*?"""/g,'').replace(/^\s*#.*$/gm,'')).join('\n');
 assert.doesNotMatch(raw,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|print\(pid\)|print\(nodes\)|print\(report\)|print\(uri\)/);
});
test('API26 strict scopes fail closed for bad stage/PID and mismatched parent',()=>{
 const script=[
  "import sys",
  "sys.path.insert(0,'tooling/android')",
  "import guardiao_candidate_release_v4_api26_scoped_four_pdf_samepid_lab as m",
  "m.home.observed_single_app_pid=lambda: 'synthetic-pid'",
  "m.BASE.screen_size=lambda: (1080,2400)",
  "m.BASE.xml_nodes=lambda: []",
  "m.scoped.scoped_triplet_category=lambda *args:m.scoped.PASS",
  "m.attest_triplet('synthetic-pid','initial')",
  "try: m.attest_triplet('wrong','initial'); assert False",
  "except RuntimeError: pass",
  "try: m.attest_triplet('synthetic-pid','forged'); assert False",
  "except RuntimeError: pass",
  "m.scoped.scoped_triplet_category=lambda *args:'bottom-label-not-unique'",
  "try: m.attest_triplet('synthetic-pid','pre-return'); assert False",
  "except RuntimeError: pass",
  "print('PASS: API26 strict scoped negative matrix')"
 ].join('\n');
 const p=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: API26 strict scoped negative matrix/);
});
