import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const geometry=readFileSync('tooling/android/guardiao_api28_debug_readonly_nav_geometry_lab.py','utf8');
const observer=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-readonly-nav-geometry.yml','utf8');
const baseWorkflow=readFileSync('.github/workflows/guardiao-api28-debug-external-a11y-readonly.yml','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_READONLY_NAV_GEOMETRY.md','utf8');

test('passive callback is callable only after strict root PPP and before a second stable PID/focus gate',()=>{
 const root=observer.indexOf('if (idle, verdict, mask) != ("idle-observed", "all-present", "PPP")');
 const call=observer.indexOf('after_verified_observation()');
 const stable=observer.indexOf('if debug_pid() != before_pid or not debug_focus():');
 assert.ok(root>=0 && call>root && stable>call);
 assert.match(observer,/def run\(\*, after_verified_observation: Callable\[\[\], None\] \| None = None\)/);
 assert.match(geometry,/observer\.run\(after_verified_observation=passive_geometry_gate\)/);
 assert.doesNotMatch(geometry,/input", "tap|input", "swipe|input", "keyevent|uiautomator", "dump|Thread\.sleep|performAction/);
});

test('single in-memory snapshot, exact known testIDs and BLOCK for unsafe geometry',()=>{
 assert.equal((geometry.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((geometry.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 for(const v of ['negresco-lab-tab-home','negresco-lab-tab-pix','negresco-lab-tab-negresco','observer.DEBUG_PACKAGE','safe_ancestor_constraint_category','targets-overlap','three-thin','three-bounded','nodes-missing-or-duplicate','package-unconfirmed'])
   assert.ok(geometry.includes(v),v);
 assert.match(geometry,/if category != "three-bounded":\s*\n\s*raise RuntimeError/);
 assert.doesNotMatch(geometry,/print\(nodes|print\(raw_bounds|print\(coordinates|print\(.*text|print\(.*xml|\.get\("text"|\.get\("content-desc"|scroll_forward|scroll_backward/);
});

test('pure classification rejects thin, overlapping, foreign, ambiguous or offscreen targets',()=>{
 const program=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_readonly_nav_geometry_lab as m',
  "ids=m.TARGETS",
  "rects=['[16,620][132,685]','[144,620][260,685]','[272,620][388,685]']",
  "def nodes(bounds=rects,package='com.negresco.finance',click='true'):",
  " return [{'resource-id':'com.negresco.finance:id/'+name,'package':package,'enabled':'true','clickable':click,'bounds':rect} for name,rect in zip(ids,bounds)]",
  "assert m.classify_three_tabs(nodes(),400,800)=='three-bounded'",
  "assert m.classify_three_tabs(nodes(['[16,620][132,628]','[144,620][260,628]','[272,620][388,628]']),400,800)=='three-thin'",
  "assert m.classify_three_tabs(nodes(['[16,620][132,685]','[100,620][260,685]','[272,620][388,685]']),400,800)=='targets-overlap'",
  "assert m.classify_three_tabs(nodes(package='com.other.app'),400,800)=='package-unconfirmed'",
  "assert m.classify_three_tabs(nodes(click='false'),400,800)=='clickability-unconfirmed'",
  "assert m.classify_three_tabs(nodes()[:2],400,800)=='nodes-missing-or-duplicate'",
  "assert m.classify_three_tabs(nodes()+nodes()[:1],400,800)=='nodes-missing-or-duplicate'",
  "assert m.classify_three_tabs(nodes(['[16,620][132,685]','[144,620][260,685]','[272,795][388,825]']),400,800)=='three-unsafe'",
  "assert m.classify_three_tabs('invalid',400,800)=='geometry-unconfirmed'",
  "assert m.classify_three_tabs(nodes(),0,800)=='geometry-unconfirmed'",
  "print('PASS (LAB): readonly geometry negative fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): readonly geometry negative fixtures/);
});

test('workflow reuses original Debug-only gates and never releases artifacts',()=>{
 for(const v of ['lab/p01-guardiao-api28-debug-readonly-nav-geometry-v1','api-level: 28','-no-snapshot','contents: read','persist-credentials: false','assembleDebug','sanitize_guardiao_debug_manifest.py','guardiao_debug_loopback_policy.py','a11y-debug-observer-lab/build_observer.sh','guardiao_api28_debug_readonly_nav_geometry_lab.py'])
   assert.ok(workflow.includes(v),v);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
 let expected=baseWorkflow;
 const changes=[
  ['name: Guardiao Debug API28 external UiAutomation readonly observer','name: Guardiao API28 Debug passive bottom tab geometry after verified root PPP'],
  ['lab/p01-guardiao-api28-debug-external-a11y-readonly-v1','lab/p01-guardiao-api28-debug-readonly-nav-geometry-v1'],
  ['guardiao-debug-a11y-external-','guardiao-debug-readonly-nav-geometry-'],
  ['name: Fresh synthetic Debug home with no-permission UiAutomation observer','name: Verify external PPP then passive Debug three-tab geometry (no gestures)'],
  ['name: Read only the Debug active-window package identity three times','name: Observe single Debug native three-tab snapshot only after stable root PPP'],
  ['script: python3 tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','script: python3 tooling/android/guardiao_api28_debug_readonly_nav_geometry_lab.py']
 ];
 for(const [a,b] of changes)expected=expected.replace(a,b);
 assert.equal(workflow,expected);
});

test('P0 and production safety gates stay explicitly blocked',()=>{
 for(const v of ['#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','No PDF'])
  assert.ok(policy.includes(v),v);
});
