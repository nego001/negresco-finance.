import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync('.github/workflows/guardiao-api28-debug-home-return-diagnostic.yml','utf8');
const oldWorkflow=readFileSync('.github/workflows/guardiao-api28-debug-nav-two-cycles.yml','utf8');
const one=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const two=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const diag=readFileSync('tooling/android/guardiao_api28_debug_return_diagnostic_lab.py','utf8');
const external=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_HOME_RETURN_DIAG_M76.md','utf8');

test('M76 changes the isolated M75 Android workflow only in labels and branch',()=>{
 let expected=oldWorkflow;
 const changes=[
  ['name: Guardiao API28 Debug two sequential preview navigation cycles','name: Guardiao API28 Debug first Home return categorical diagnosis'],
  ['lab/p01-guardiao-api28-debug-nav-two-cycles-v1','lab/p01-guardiao-api28-debug-return-diagnostic-v1'],
  ['guardiao-debug-nav-two-cycles-','guardiao-debug-home-return-diagnostic-'],
  ['name: Exactly two guarded preview navigation cycles in one Debug PID','name: Debug guarded two cycles with fixed-category Home-return diagnosis'],
  ['name: Validate two sequential guarded preview cycles in one Debug process','name: Diagnose Home return within unchanged two-cycle guarded preview']
 ];
 for(const [a,b] of changes){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});

test('M76 keeps one root PPP, same settling, and exactly original two guarded taps per cycle',()=>{
 assert.match(external,/time\.sleep\(30\.0\)/);
 assert.match(external,/if \(idle, verdict, mask\) != \("idle-observed", "all-present", "PPP"\)/);
 assert.match(two,/CYCLES: tuple\[str, str\] = \("first", "second"\)/);
 assert.match(two,/navigation\.run_two_step_navigation\(\)/);
 assert.equal((one.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((one.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((one.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((one.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(one,/home\.passive_home_census\(\)/);
 assert.match(one,/gate\.select_preview_target\(/);
 assert.match(one,/pix_static_proven\(nodes\)/);
 assert.match(one,/finally:\s*\n\s*BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(one,/STAGE\.advance\("sequence-complete"\)/);
 assert.doesNotMatch(two,/"input"|"tap"|time\.sleep|xml_nodes\(/);
});

test('read-only return categories cannot authorize a rejected original gate',()=>{
 for(const category of ['not-started','home-input-command-returned','post-home-process-or-focus-unconfirmed',
 'post-home-snapshot-unconfirmed','post-home-classifier-unconfirmed','post-home-tabs-unconfirmed',
 'post-home-marker-unconfirmed','post-home-static-unconfirmed','post-home-structure-unconfirmed',
 'post-home-candidate-unconfirmed','post-home-attested']) assert.ok(diag.includes(category),category);
 assert.match(one,/RETURN_DIAGNOSTIC = return_diag\.classify\(/);
 assert.match(one,/if RETURN_DIAGNOSTIC != "post-home-attested":\s*\n\s*raise RuntimeError/);
 assert.match(one,/except Exception:\s*\n\s*RETURN_DIAGNOSTIC = "post-home-snapshot-unconfirmed"/);
 assert.match(one,/except Exception:\s*\n\s*RETURN_DIAGNOSTIC = "post-home-process-or-focus-unconfirmed"/);
 assert.match(two,/if reason not in RETURN_CATEGORIES:/);
 assert.match(two,/ENV \(LAB\): debug-nav-home-return=/);
 assert.doesNotMatch(diag,/\.adb\(|subprocess|xml_nodes\(|print\(|import\s+logging\b|logging\.|socket|time\.sleep|os\.system|requests|urllib/);
 assert.doesNotMatch(two,/print\(\s*str\(e\)|traceback\.print|print\([^)]*\+\s*(?:pid|point|nodes|bounds)\b/);
});

test('pure malformed and failed gate fixtures return fixed block diagnoses',()=>{
 const script=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_return_diagnostic_lab as d',
 "good=('tabs-present-bounded','home-marker-unique','home-static-all','app-text-and-clickable','eligible-candidate-only')",
 "assert d.classify(*good)=='post-home-attested'",
 "expected=('post-home-tabs-unconfirmed','post-home-marker-unconfirmed','post-home-static-unconfirmed','post-home-structure-unconfirmed','post-home-candidate-unconfirmed')",
 'for idx,category in enumerate(expected):',
 ' bad=list(good);bad[idx]=None',
 ' assert d.classify(*bad)==category',
 ' assert d.classify(*bad) in d.RETURN_CATEGORIES',
 "assert d.classify('', '', '', '', '')=='post-home-tabs-unconfirmed'",
 "print('PASS (LAB): M76 return diagnostics fail-closed fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M76 return diagnostics fail-closed fixtures/);
});

test('preregistration retains historical BLOCK, independent 429 and no production clearance',()=>{
 for(const value of ['M75','M76','home-input-command-returned','HTTP 429','1,680/1,680',
 '#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false'])
  assert.ok(policy.includes(value),value);
 assert.match(policy,/no retry/i);
});
