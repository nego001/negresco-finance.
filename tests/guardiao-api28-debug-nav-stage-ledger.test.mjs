import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const ledger=readFileSync('tooling/android/guardiao_api28_debug_nav_stage_ledger.py','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_NAV_STAGE_LEDGER_STAGING.md','utf8');
const oldWorkflow=readFileSync('.github/workflows/guardiao-api28-debug-nav-preview-two-step.yml','utf8');

test('M71 pure stage ledger has fixed forward-only categories, no external operations or sensitive values',()=>{
 for(const stage of ['preflight-pending','home-attested','pix-candidate-attested','pix-input-command-returned','pix-preview-content-attested','home-candidate-attested','home-input-command-returned','home-return-content-attested','sequence-complete'])
  assert.ok(ledger.includes(stage),stage);
 assert.equal((ledger.match(/def advance\(/g)||[]).length,1);
 assert.match(ledger,/category != CHECKPOINTS\[self\._index \+ 1\]/);
 assert.doesNotMatch(ledger,/\.adb\(|subprocess|print\(|logging|xml_nodes\(|requests|urllib|time\.sleep|open\(|getText|input", "tap|swipe\(|pdf\.generate\(|os\.system/);
});

test('pure ledger requires exact monotone progression and rejects unknown, duplicate or skipped steps',()=>{
 const code=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_nav_stage_ledger as m',
  'ledger=m.StageLedger()',
  "assert ledger.category=='preflight-pending'",
  "for value in m.CHECKPOINTS[1:]: ledger.advance(value)",
  "assert ledger.category=='sequence-complete'",
  "def blocked(check, value):",
  " try: check.advance(value)",
  " except RuntimeError: return True",
  " return False",
  "assert blocked(ledger,'sequence-complete')",
  "new=m.StageLedger()",
  "assert blocked(new,'pix-candidate-attested')",
  "assert blocked(new,42)",
  "assert blocked(new,'SENSITIVE VALUE')",
  "new.advance('home-attested')",
  "assert blocked(new,'home-attested')",
  "assert new.category=='home-attested'",
  "assert blocked(new,'pix-input-command-returned')",
  "print('PASS (LAB): fixed stage ledger monotone negative fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): fixed stage ledger monotone negative fixtures/);
});

test('M69 original tap and snapshot safety gates are unchanged in the staging branch',()=>{
 assert.match(runner,/observer\.run\(after_verified_observation=run_two_step_navigation\)/);
 assert.match(runner,/home\.passive_home_census\(\)/);
 assert.match(runner,/gate\.select_preview_target\(/);
 assert.match(runner,/pix_static_proven\(nodes\)/);
 assert.match(runner,/stable_app\(pid\)/);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((runner.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(runner,/finally:\s*\n\s*# Always delete exactly as before,[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(runner,/SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"/);
 assert.match(oldWorkflow,/lab\/p01-guardiao-api28-debug-nav-preview-two-step-v1/);
 assert.doesNotMatch(oldWorkflow,/lab\/p01-guardiao-api28-debug-nav-stage-ledger-v1/);
});

test('M71 checkpoints occur only after their corresponding gate or command returns',()=>{
 const expected=[
  'STAGE.advance("home-attested")',
  'STAGE.advance("pix-candidate-attested")',
  'STAGE.advance("pix-input-command-returned")',
  'STAGE.advance("pix-preview-content-attested")',
  'STAGE.advance("home-candidate-attested")',
  'STAGE.advance("home-input-command-returned")',
  'STAGE.advance("home-return-content-attested")',
  'STAGE.advance("sequence-complete")',
 ];
 assert.equal((runner.match(/STAGE\.advance\(/g)||[]).length,expected.length);
 for(let i=1;i<expected.length;i++)
  assert.ok(runner.indexOf(expected[i])>runner.indexOf(expected[i-1]),expected[i]);
 assert.ok(runner.indexOf('STAGE.advance("home-attested")')>runner.indexOf('home.passive_home_census()'));
 assert.ok(runner.indexOf('STAGE.advance("pix-input-command-returned")')>runner.indexOf('guarded_preview_tap(pix_center)'));
 assert.ok(runner.indexOf('STAGE.advance("home-input-command-returned")')>runner.indexOf('guarded_preview_tap(home_center)'));
 assert.match(runner,/ENV \(LAB\): debug-nav-last-checkpoint=/);
 assert.doesNotMatch(runner,/print\(.*point\[|print\(.*pid|print\(.*nodes|print\(.*bounds|print\(.*\.get\("text"/);
});

test('staging policy prevents premature Android gestures or production release',()=>{
 for(const s of ['M69','M70','M71','No new gesture runs','no new Android workflow','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','**not** proof'])
  assert.ok(policy.toLowerCase().includes(s.toLowerCase()),s);
});
