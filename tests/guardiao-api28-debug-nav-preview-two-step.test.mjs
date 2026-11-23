import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const guard=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_guard.py','utf8');
const observer=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-nav-preview-two-step.yml','utf8');
const baseline=readFileSync('.github/workflows/guardiao-api28-debug-startup-settle-30s.yml','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_NAV_PREVIEW_TWO_STEP.md','utf8');

test('M69 requires read-only Home census before first of exactly two guarded preview taps',()=>{
 const home=runner.indexOf('home.passive_home_census()');
 const pid=runner.indexOf('pid = observer.debug_pid()');
 const first=runner.indexOf('gate.select_preview_target(');
 const tap1=runner.indexOf('guarded_preview_tap(pix_center)');
 const pix=runner.indexOf('if not pix_static_proven(nodes):');
 const tap2=runner.indexOf('guarded_preview_tap(home_center)');
 const final=runner.indexOf('nav, marker = counts.classify_snapshot(nodes, width, height)');
 assert.ok(home>0 && pid>home && first>pid && tap1>first && pix>tap1 && tap2>pix && final>tap2);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.match(runner,/observer\.run\(after_verified_observation=run_two_step_navigation\)/);
 assert.match(observer,/if \(idle, verdict, mask\) != \("idle-observed", "all-present", "PPP"\)/);
 assert.match(observer,/time\.sleep\(30\.0\)/);
 assert.match(runner,/stable_app\(pid\)/);
 assert.doesNotMatch(runner,/"keyevent"|"swipe"|"pm", "clear"|"force-stop"|startActivity\(|pdf_then_navigate\(|exportLocalPdf\(/);
});

test('each of three additional private snapshots deletes raw XML even after exceptions',()=>{
 assert.equal((runner.match(/private_snapshot\(\)/g)||[]).length,4); // definition + three planned invocations
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.match(runner,/finally:\s*\n\s*# Always delete exactly as before,[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(runner,/SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"/);
 assert.doesNotMatch(runner,/print\(nodes|print\(.*bounds|print\(.*coords|print\(.*raw|print\(.*pid|\.adb\("logcat"|upload-artifact/);
});

test('source-bound Pix preview content is required before Home return, and Home final state is strict',()=>{
 for(const x of ['TRANSFERÊNCIAS','Pix do seu jeito.','pix_static_proven(nodes)','"pix", "home"','"home", "pix"'])
   assert.ok(runner.includes(x),x);
 const returnDiag=readFileSync('tooling/android/guardiao_api28_debug_return_diagnostic_lab.py','utf8');
 for(const x of ['tabs-present-bounded','home-marker-unique','home-static-all','app-text-and-clickable'])
   assert.ok(returnDiag.includes(x),x);
 assert.match(runner,/if RETURN_DIAGNOSTIC != "post-home-attested":/);
 assert.match(guard,/safe_ancestor_constraint_category/);
 assert.match(guard,/blocked-ambiguous-or-unsafe/);
 assert.match(runner,/if category != gate\.ELIGIBLE or home_center is None:/);
 assert.match(runner,/if category != gate\.ELIGIBLE or pix_center is None:/);
});

test('pure Pix markers and candidate tap helper reject invalid values without device traffic',()=>{
 const program=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_nav_preview_two_step_lab as m',
  "markers=[{'package':m.APP,'class':'android.widget.TextView','text':x} for x in m.PIX_TEXTS]",
  "assert m.pix_static_proven(markers) is True",
  "assert m.pix_static_proven(markers[:1]) is False",
  "assert m.pix_static_proven(markers+markers[:1]) is False",
  "assert m.pix_static_proven([dict(x,**{'package':'com.foreign'}) for x in markers]) is False",
  "assert m.pix_static_proven('nope') is False",
  "try:",
  " m.guarded_preview_tap((-1,20))",
  " raise AssertionError('unsafe tap accepted')",
  "except RuntimeError: pass",
  "print('PASS (LAB): M69 Pix-only preview semantic fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M69 Pix-only preview semantic fixtures/);
});

test('new Android workflow copies exact reviewed M66 isolated Debug policy, not Release',()=>{
 let expected=baseline;
 const replacements=[
  ['name: Guardiao API28 Debug isolated 30s first-read startup settling study','name: Guardiao API28 Debug two-step synthetic preview navigation lab'],
  ['lab/p01-guardiao-api28-debug-startup-settle-30s-v1','lab/p01-guardiao-api28-debug-nav-preview-two-step-v1'],
  ['guardiao-debug-settle-30s-','guardiao-debug-nav-preview-two-step-'],
  ['name: Predeclared 30s startup delay then one Debug PPP/Home census','name: Two geometry-gated Debug preview tabs Home-Pix-Home after PPP'],
  ['name: Single Debug Home and native census after fixed 30s settling interval','name: Attempt two strictly bounded preview taps after independent Home proof'],
  ['script: python3 tooling/android/guardiao_api28_debug_native_transport_triage_lab.py','script: python3 tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py']
 ];
 for(const [a,b] of replacements){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
 for(const value of ['api-level: 28','-no-snapshot','contents: read','persist-credentials: false','assembleDebug','a11y-debug-observer-lab/build_observer.sh'])
   assert.ok(workflow.includes(value),value);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
});

test('M69 documentation preregisters two fixed touches and keeps production/P0 fail-closed',()=>{
 for(const x of ['M67','M68','M69','exactly three','Home → Pix → Home','2-second','No PDF','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false'])
   assert.ok(doc.includes(x),x);
});
