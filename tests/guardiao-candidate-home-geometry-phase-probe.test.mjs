import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('tooling/android/guardiao_candidate_home_geometry_phase_probe.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-candidate-home-geometry-phase-probe.yml','utf8');

test('the read-only phase probe preserves the original candidate PDF and Home gates',()=>{
 assert.match(source,/same\.run\(\)/);
 assert.match(source,/same\.candidate\.run = original_candidate_run/);
 assert.match(source,/BASE\.wait_visible = prior_wait/);
 assert.match(source,/BASE\.wait_export_button = prior_pdf_button/);
 assert.match(source,/home\.safe_home_layout_snapshot_category/);
 assert.match(source,/home\.safe_initial_home_detail/);
 assert.match(source,/home\.safe_ime_flag_pair/);
 assert.doesNotMatch(source,/BASE\.adb\("shell", "input"|force-stop|pm", "clear"|input", "tap"|print\(raw\)|print\(nodes\)|print\(exc\)/);
 assert.match(workflow,/run-id: 43752538618/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_candidate_home_geometry_phase_probe\.py/);
 assert.match(workflow,/sha256sum --check --strict/);
 assert.match(workflow,/CN=Android Debug/);
 assert.doesNotMatch(workflow,/assembleRelease|assembleDebug|upload-artifact|workflow_dispatch|secrets\.|eas update|contents: write/i);
});
test('fixed categories cannot reveal arbitrary Android output or recognize untrusted stages',()=>{
 const py=[
  "import sys",
  "sys.path.insert(0,'tooling/android')",
  "import guardiao_candidate_home_geometry_phase_probe as x",
  "assert x.fixed('point-only',x.SHAPES)=='point-only'",
  "assert x.fixed('SECRET_XML',x.SHAPES)=='unconfirmed'",
  "assert x.fixed('view-only-shown',x.IME)=='view-only-shown'",
  "assert x.fixed({'unexpected':'value'},x.IME)=='unconfirmed'",
  "try:x.observe('private-message')",
  "except RuntimeError:pass",
  "else:raise AssertionError('untrusted stage accepted')",
  "print('PASS: bounded read-only Home geometry categories')"
 ].join('\n');
 const p=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: bounded read-only Home geometry categories/);
});
