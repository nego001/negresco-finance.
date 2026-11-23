import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const original=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_NAV_TWO_CYCLES_STAGING.md','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-nav-stage-ledger-repeat.yml','utf8');

test('M74 staging delegates exactly two known complete rounds with one stable PID and no direct device input',()=>{
 assert.match(source,/CYCLES: tuple\[str, str\] = \("first", "second"\)/);
 assert.match(source,/for label in CYCLES:/);
 assert.equal((source.match(/navigation\.run_two_step_navigation\(\)/g)||[]).length,1);
 assert.match(source,/navigation\.STAGE = StageLedger\(\)/);
 assert.match(source,/navigation\.STAGE\.category != "sequence-complete"/);
 assert.match(source,/observer\.debug_pid\(\) != baseline_pid/);
 assert.match(source,/observer\.run\(after_verified_observation=twice_same_process\)/);
 assert.doesNotMatch(source,/\.adb\(|"input"|"tap"|xml_nodes\(|getRootInActiveWindow\(|subprocess|startActivity\(|force-stop|time\.sleep\(|takeScreenshot\(|\.screenshot\(|logcat\(/);
 assert.doesNotMatch(workflow,/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
});

test('pure monkeypatched fixtures prove two sequential completes, and fail on second',()=>{
 const python=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_nav_two_cycles_staging_lab as m',
  'from guardiao_api28_debug_nav_stage_ledger import CHECKPOINTS',
  "m.observer.debug_pid=lambda:'stable'",
  'm.observer.debug_focus=lambda:True',
  'calls=[]',
  'def good_cycle():',
  ' calls.append(m.ACTIVE)',
  ' for s in CHECKPOINTS[1:]: m.navigation.STAGE.advance(s)',
  'm.navigation.run_two_step_navigation=good_cycle',
  'm.twice_same_process()',
  "assert calls==['first','second']",
  "assert m.LAST_COMPLETE=='second'",
  'm.ACTIVE="not-started";m.LAST_COMPLETE="none";calls.clear()',
  'def broken_cycle():',
  ' calls.append(m.ACTIVE)',
  " if len(calls)==2: raise RuntimeError('no private value printed')",
  ' for s in CHECKPOINTS[1:]: m.navigation.STAGE.advance(s)',
  'm.navigation.run_two_step_navigation=broken_cycle',
  'try:',
  ' m.twice_same_process()',
  " raise AssertionError('blocked second cycle should never succeed')",
  'except RuntimeError: pass',
  "assert calls==['first','second']",
  "assert m.ACTIVE=='second' and m.LAST_COMPLETE=='first'",
  "print('PASS (LAB): M74 two-cycle isolated fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',python],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M74 two-cycle isolated fixtures/);
});

test('M74 error path outputs only fixed allowlisted stage and cycle categories',()=>{
 assert.match(source,/cycle = ACTIVE if ACTIVE in \("first", "second"\) else "not-started"/);
 assert.match(source,/complete = LAST_COMPLETE if LAST_COMPLETE in \("first", "second"\) else "none"/);
 assert.match(source,/checkpoint not in CHECKPOINTS/);
 assert.match(source,/debug-nav-active-cycle=/);
 assert.match(source,/debug-nav-last-complete-cycle=/);
 assert.match(source,/debug-nav-last-checkpoint=/);
 assert.match(source,/BLOCK \(LAB\): two complete Debug preview nav cycles not attested/);
 assert.doesNotMatch(source,/print\(\s*str\(e\)|traceback\.print|print\([^)]*\+\s*(?:pid|point|nodes|bounds)\b/);
});

test('existing M72 guarded one-cycle logic remains the sole source of synthetic taps and XML cleanup',()=>{
 assert.equal((original.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((original.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((original.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.match(original,/home\.passive_home_census\(\)/);
 assert.match(original,/pix_static_proven\(nodes\)/);
 assert.match(original,/stable_app\(pid\)/);
 assert.match(original,/finally:\s*\n\s*# Always delete exactly as before,[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(original,/SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"/);
});

test('staging docs retain future-only test plan and independent PDF and Release P0 gates',()=>{
 for(const x of ['M72','M73','M74','2/2','four','No new Android workflow','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false'])
  assert.ok(policy.toLowerCase().includes(x.toLowerCase()),x);
 assert.match(policy,/not.*original two-PDF-cycle test/i);
 assert.match(policy,/no retry/i);
});
