import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const home=readFileSync('tooling/android/guardiao_candidate_release_root_v4_api28_home_only_lab.py','utf8');
const pdf=readFileSync('tooling/android/guardiao_candidate_release_root_v4_api28_pdf_lab.py','utf8');
const repeated=readFileSync('tooling/android/guardiao_candidate_release_root_v4_api28_same_pid_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-candidate-release-root-v4-api28-e2e.yml','utf8');

test('root-bottom-inset Release candidate v4 has distinct fixed SHA and no publishing capabilities',()=>{
 assert.match(pdf,/PINNED_CANDIDATE = "3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6"/);
 assert.match(pdf,/ORIGINAL_IMMUTABLE = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(pdf,/contract\.REQUIRED/);
 assert.match(pdf,/semantic\.ensure_absent\(\)/);
 assert.match(workflow,/run-id: 43772274643/);
 assert.match(workflow,/scenario: \[home_only, same_pid\]/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/sha256sum --check --strict/);
 assert.match(workflow,/CN=Android Debug/);
 assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/assembleRelease|assembleDebug|upload-artifact|workflow_dispatch|secrets\.|eas update|contents: write/i);
});
test('initial Home geometry is read-only and fails closed without touch or XML disclosure',()=>{
 assert.match(home,/classify\(BASE\.xml_nodes\(\),width,height\)/);
 assert.match(home,/first!=second or second!=VALID/);
 assert.match(home,/home\.observed_single_app_pid\(\)!=pid/);
 assert.match(home,/candidate\.candidate_identity\(candidate\.APK\)/);
 assert.match(home,/BASE\.wait_visible\("Seu universo",retries=45\)/);
 // Exclude explanatory Python docstrings/comments: words like "force-stop"
 // are allowed in documentation, but executable Android input is not.
 const executable=home.replace(/"""[\s\S]*?"""/g,'').replace(/^\s*#.*$/gm,'');
 assert.doesNotMatch(executable,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|print\(nodes\)|print\(pid\)|print\(result\)|screencap/);
 const code=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_candidate_release_root_v4_api28_home_only_lab as x',
  'assert x.classify([],1080,960)[0]=="home-label-unconfirmed"',
  'assert x.classify(None,1080,960)[0]=="home-layout-unconfirmed"',
  'assert x.classify([],-1,960)[0]=="home-layout-unconfirmed"',
  'assert x.VALID==("home-label-bounded","on-bottom-band","geometry-eligible","siblings-both-regular")',
  'print("PASS: strict read-only Release candidate initial Home classifications")'
 ].join('\n');
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS: strict read-only Release candidate initial Home classifications/);
});
test('four PDF cycles require unchanged PID, strict bounded Home and independent receipts',()=>{
 assert.match(repeated,/CYCLES = \("a", "b", "c", "d"\)/);
 assert.match(repeated,/home\.restore_home_tab_in_same_process\(baseline_pid\)/);
 assert.match(repeated,/if not skipped or not home_verified/);
 assert.match(repeated,/semantic\.ensure_absent\(\)/);
 assert.match(repeated,/candidate\.candidate_identity\(candidate\.APK\)/);
 assert.match(repeated,/four consecutive root-bottom-inset Release-mode PDFs/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_candidate_release_root_v4_api28_\$\{\{ matrix\.scenario \}\}_lab\.py/);
});
