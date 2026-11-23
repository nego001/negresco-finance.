import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const diag=readFileSync('tooling/android/guardiao_api28_debug_nav_preflight_stage_lab.py','utf8');
const old=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const guard=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_guard.py','utf8');
const original=readFileSync('.github/workflows/guardiao-api28-debug-nav-preview-two-step.yml','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-nav-preflight-stage.yml','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_NAV_PREFLIGHT_STAGE.md','utf8');

test('M70 inherits PPP, 30s, strict Home and one cleanup-protected extra read, but has no gesture calls',()=>{
 assert.match(diag,/observer\.run\(after_verified_observation=passive_preflight\)/);
 assert.match(diag,/home\.passive_home_census\(\)/);
 assert.match(diag,/previous\.private_snapshot\(\)/);
 assert.match(old,/finally:\s*\n\s*# Always delete exactly as before,[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(old,/SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"/);
 assert.match(diag,/if observer\.debug_pid\(\) != pid or not observer\.debug_focus\(\):/);
 assert.match(diag,/if state != "candidate-eligible":/);
 assert.doesNotMatch(diag,/\.adb\(|"input"|"tap"|"swipe"|"keyevent"|performAction|guarded_preview_tap\(|subprocess|xml_nodes\(|print\(nodes|print\(.*bounds|print\(.*pid|logcat|takeScreenshot/);
});
test('M70 categories are fixed and still delegate the actual candidate decision to the M68 pure guard',()=>{
 for(const s of ['snapshot-unconfirmed','source-marker-missing-or-duplicate','destination-marker-unexpected','tab-id-missing-or-duplicate','tab-package-mismatch','tab-not-clickable-or-enabled','tab-selected-state-mismatch','tab-bounds-invalid','tab-geometry-unsafe','tab-targets-overlap','clickable-occluder-or-unknown','candidate-eligible'])
  assert.ok(diag.includes(s),s);
 assert.match(diag,/guard\.select_preview_target\(\s*\n?\s*nodes, width, height, "home", "pix"/);
 assert.match(diag,/safe_ancestor_constraint_category/);
 assert.match(guard,/blocked-ambiguous-or-unsafe/);
});
test('pure first-candidate classifier distinguishes missing, selected, overlap, foreign and occlusion',()=>{
 const program=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_nav_preflight_stage_lab as m',
  "ids=m.guard.TARGETS",
  "rects=['[16,620][132,685]','[144,620][260,685]','[272,620][388,685]']",
  "def make():",
  " nodes=[{'package':m.PACKAGE,'resource-id':m.guard.PAGE_IDS['home']+'no-call-no','clickable':'false','enabled':'true'}]",
  " for i,name in enumerate(ids):",
  "  nodes.append({'package':m.PACKAGE,'resource-id':m.PACKAGE+':id/'+name,'clickable':'true','enabled':'true','selected':'true' if i==0 else 'false','bounds':rects[i]})",
  " return nodes",
  "data=make()",
  "assert m.diagnosis(data,400,800)=='candidate-eligible'",
  "assert m.diagnosis(data[1:],400,800)=='source-marker-missing-or-duplicate'",
  "assert m.diagnosis(data+[data[0]],400,800)=='source-marker-missing-or-duplicate'",
  "pix={'package':m.PACKAGE,'resource-id':m.guard.PAGE_IDS['pix']+'no-call-no'}",
  "assert m.diagnosis(data+[pix],400,800)=='destination-marker-unexpected'",
  "assert m.diagnosis(data[:-1],400,800)=='tab-id-missing-or-duplicate'",
  "assert m.diagnosis(data+[data[1]],400,800)=='tab-id-missing-or-duplicate'",
  "foreign=[dict(x) for x in data];foreign[2]['package']='com.foreign.app'",
  "assert m.diagnosis(foreign,400,800)=='tab-package-mismatch'",
  "disabled=[dict(x) for x in data];disabled[2]['enabled']='false'",
  "assert m.diagnosis(disabled,400,800)=='tab-not-clickable-or-enabled'",
  "bad_selected=[dict(x) for x in data];bad_selected[2]['selected']='true'",
  "assert m.diagnosis(bad_selected,400,800)=='tab-selected-state-mismatch'",
  "bounds=[dict(x) for x in data];bounds[2]['bounds']='bad'",
  "assert m.diagnosis(bounds,400,800)=='tab-bounds-invalid'",
  "thin=[dict(x) for x in data];thin[2]['bounds']='[144,620][260,628]'",
  "assert m.diagnosis(thin,400,800)=='tab-geometry-unsafe'",
  "overlap=[dict(x) for x in data];overlap[2]['bounds']='[100,620][260,685]'",
  "assert m.diagnosis(overlap,400,800)=='tab-targets-overlap'",
  "cover=data+[{'package':'com.foreign.app','resource-id':'','clickable':'true','enabled':'true','bounds':'[150,630][251,675]'}]",
  "assert m.diagnosis(cover,400,800)=='clickable-occluder-or-unknown'",
  "assert m.diagnosis('bad',400,800)=='snapshot-unconfirmed'",
  "assert m.diagnosis(data,0,800)=='snapshot-unconfirmed'",
  "print('PASS (LAB): M70 fail-closed pure candidate diagnoses')",
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M70 fail-closed pure candidate diagnoses/);
});
test('workflow copies only known Debug-only policy and changes branch, names and runner, no Release',()=>{
 let expected=original;
 const changes=[
  ['name: Guardiao API28 Debug two-step synthetic preview navigation lab','name: Guardiao API28 Debug read-only first-Pix-target preflight'],
  ['lab/p01-guardiao-api28-debug-nav-preview-two-step-v1','lab/p01-guardiao-api28-debug-nav-preflight-stage-v1'],
  ['guardiao-debug-nav-preview-two-step-','guardiao-debug-nav-preflight-stage-'],
  ['name: Two geometry-gated Debug preview tabs Home-Pix-Home after PPP','name: Read-only Debug Pix first-target preflight after PPP'],
  ['name: Attempt two strictly bounded preview taps after independent Home proof','name: Diagnose one Home-Pix candidate without touching the screen'],
  ['script: python3 tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','script: python3 tooling/android/guardiao_api28_debug_nav_preflight_stage_lab.py']
 ];
 for(const [a,b] of changes){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
 for(const s of ['api-level: 28','-no-snapshot','assembleDebug','contents: read','persist-credentials: false','a11y-debug-observer-lab/build_observer.sh'])
  assert.ok(workflow.includes(s),s);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
});
test('document keeps no-tap scope and P0/Release gates clear',()=>{
 for(const s of ['M69','M70','does not call `input tap`','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','BLOCK','candidate-eligible'])
   assert.ok(policy.includes(s),s);
});
