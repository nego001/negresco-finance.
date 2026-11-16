import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const py=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
const wf=readFileSync('.github/workflows/guardiao-candidate-release-v4-scoped-four-pdf-api28.yml','utf8');
test('same APK and independent receiver reused without changing release behavior',()=>{
 assert.match(wf,/run-id: 43772274643/);
 assert.match(wf,/3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6/);
 assert.match(wf,/CN=Android Debug/);
 assert.match(wf,/scenario: \[same_pid\]/);
 assert.match(wf,/api-level: 28/);
 assert.match(wf,/persist-credentials: false/);
 assert.match(wf,/build_receiving_apk.sh/);
 assert.match(wf,/pdftotext/);
 assert.doesNotMatch(wf,/assembleRelease|assembleDebug|upload-artifact|workflow_dispatch|secrets\.|contents: write|eas update/i);
});
test('scoped pass is mandatory before and after every existing Home gesture, no extra gestures',()=>{
 assert.match(py,/attest_triplet\(pid, "pre-return"\)/);
 assert.match(py,/original_restore\(pid\)/);
 assert.match(py,/attest_triplet\(pid, "post-return"\)/);
 assert.match(py,/attest_triplet\(pid, "initial"\)/);
 assert.match(py,/repeated\.run\(\)/);
 assert.match(py,/home\.restore_home_tab_in_same_process = original_restore/);
 assert.match(py,/BASE\.wait_visible = original_wait/);
 assert.match(py,/if initial_count != 1 or return_count != 3:/);
 assert.match(py,/candidate\.candidate_identity\(candidate\.APK\)/);
 const executable=py.replace(/"""[\s\S]*?"""/g,'').replace(/^\s*#.*$/gm,'');
 assert.doesNotMatch(executable,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|screencap|print\(nodes\)|print\(pid\)/);
});
test('passive attestation rejects bad category, process drift and invalid stage',()=>{
 const script=[
  "import sys",
  "sys.path.insert(0,'tooling/android')",
  "import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as m",
  "m.home.observed_single_app_pid=lambda: 'synthetic-pid'",
  "m.BASE.screen_size=lambda: (1080,2400)",
  "m.BASE.xml_nodes=lambda: []",
  "seen=[]",
  "def good(*args):",
  " seen.append('snapshot')",
  " return m.scoped.PASS",
  "m.scoped.scoped_triplet_category=good",
  "m.attest_triplet('synthetic-pid','initial')",
  "assert seen==['snapshot','snapshot']",
  "m.scoped.scoped_triplet_category=lambda *args: 'unconfirmed'",
  "try: m.attest_triplet('synthetic-pid','pre-return'); assert False",
  "except RuntimeError: pass",
  "try: m.attest_triplet('other-pid','pre-return'); assert False",
  "except RuntimeError: pass",
  "try: m.attest_triplet('synthetic-pid','forged'); assert False",
  "except RuntimeError: pass",
  "print('PASS: strict passive phase attestation')"
 ].join('\n');
 const p=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: strict passive phase attestation/);
});
