import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_api28_debug_targetid_presence_lab.py','utf8');
const base=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const geom=readFileSync('tooling/android/guardiao_api28_debug_readonly_nav_geometry_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-targetid-presence.yml','utf8');
const baseline=readFileSync('.github/workflows/guardiao-api28-debug-readonly-nav-geometry.yml','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_TARGETID_PRESENCE.md','utf8');

test('M63 callback only runs after strict external PPP and stable root preflight',()=>{
 const p=base.indexOf('if (idle, verdict, mask) != ("idle-observed", "all-present", "PPP")');
 const callback=base.indexOf('after_verified_observation()');
 assert.ok(p>0 && callback>p);
 assert.match(runner,/observer\.run\(after_verified_observation=passive_presence_diagnosis\)/);
 assert.match(base,/if debug_pid\(\) != before_pid or not debug_focus\(\):/);
});

test('one snapshot, strict known IDs, only allowlisted categories, no gestures or sensitive dumps',()=>{
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 for(const phrase of ['negresco-lab-rn-page-home-','TARGETS = geometry.TARGETS','DEBUG.safe_testid_matches','tabs-all-missing','tabs-one-missing','tabs-two-missing','tabs-duplicate','tabs-present-bounded','tabs-present-thin','no-debug-package-nodes','home-marker-unique'])
  assert.ok(runner.includes(phrase),phrase);
 assert.match(runner,/finally:[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(runner,/if state != "tabs-present-bounded":\s*\n\s*raise RuntimeError/);
 assert.doesNotMatch(runner,/print\(nodes|print\(raw|print\(.*text|print\(.*bounds|print\(.*xml|\.get\("text"|\.get\("content-desc"|input", "tap|input", "swipe|input", "keyevent|scroll_forward|scroll_backward/);
 assert.match(geom,/safe_ancestor_constraint_category/);
});

test('classification separates fully missing, partial, duplicate, foreign and unsafe bounds',()=>{
 const program=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_targetid_presence_lab as p',
 "targets=p.TARGETS",
 "bounds=['[16,620][132,685]','[144,620][260,685]','[272,620][388,685]']",
 "def make(index, bound):",
 " return {'resource-id':'com.negresco.finance:id/'+targets[index],'package':'com.negresco.finance','enabled':'true','clickable':'true','bounds':bound}",
 "m=[make(i,b) for i,b in enumerate(bounds)]",
 "page={'resource-id':'com.negresco.finance:id/negresco-lab-rn-page-home-pressin-no','package':'com.negresco.finance'}",
 "assert p.classify_snapshot(m+[page],400,800)==('tabs-present-bounded','home-marker-unique')",
 "assert p.classify_snapshot([page],400,800)==('tabs-all-missing','home-marker-unique')",
 "assert p.classify_snapshot(m[:1]+[page],400,800)==('tabs-two-missing','home-marker-unique')",
 "assert p.classify_snapshot(m[:2]+[page],400,800)==('tabs-one-missing','home-marker-unique')",
 "assert p.classify_snapshot(m+[m[0],page],400,800)==('tabs-duplicate','home-marker-unique')",
 "assert p.classify_snapshot([dict(x,**{'package':'com.foreign.app'}) for x in m],400,800)==('no-debug-package-nodes','home-marker-absent')",
 "thin=[make(i,rect) for i,rect in enumerate(['[16,620][132,627]','[144,620][260,627]','[272,620][388,627]'])]",
 "assert p.classify_snapshot(thin+[page],400,800)==('tabs-present-thin','home-marker-unique')",
 "invalid=[make(i,rect) for i,rect in enumerate(['[16,620][132,685]','[144,620][260,685]','[272,799][388,825]'])]",
 "assert p.classify_snapshot(invalid+[page],400,800)==('tabs-present-unsafe','home-marker-unique')",
 "assert p.classify_snapshot(m+[page,page],400,800)==('tabs-present-bounded','home-marker-duplicate')",
 "assert p.classify_snapshot('invalid',400,800)==('snapshot-unconfirmed','home-marker-unconfirmed')",
 "assert p.classify_snapshot(m,0,800)==('snapshot-unconfirmed','home-marker-unconfirmed')",
 "print('PASS (LAB): categorical target-ID diagnosis fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): categorical target-ID diagnosis fixtures/);
});

test('workflow duplicates Debug build/security gating, changes only branch, labels and M63 script',()=>{
 for(const v of ['lab/p01-guardiao-api28-debug-targetid-presence-v1','api-level: 28','assembleDebug','persist-credentials: false','contents: read','-no-snapshot','a11y-debug-observer-lab/build_observer.sh','guardiao_api28_debug_targetid_presence_lab.py'])
   assert.ok(workflow.includes(v),v);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
 let copy=baseline;
 const changes=[
  ['name: Guardiao API28 Debug passive bottom tab geometry after verified root PPP','name: Guardiao API28 Debug target-id presence diagnosis after verified PPP'],
  ['lab/p01-guardiao-api28-debug-readonly-nav-geometry-v1','lab/p01-guardiao-api28-debug-targetid-presence-v1'],
  ['guardiao-debug-readonly-nav-geometry-','guardiao-debug-targetid-presence-'],
  ['name: Verify external PPP then passive Debug three-tab geometry (no gestures)','name: Debug target-id count and Home marker categories after PPP (no gestures)'],
  ['name: Observe single Debug native three-tab snapshot only after stable root PPP','name: Classify single Debug nav testID snapshot after verified root PPP'],
  ['script: python3 tooling/android/guardiao_api28_debug_readonly_nav_geometry_lab.py','script: python3 tooling/android/guardiao_api28_debug_targetid_presence_lab.py']
 ];
 for(const [a,b] of changes){assert.ok(copy.includes(a));copy=copy.replace(a,b);}
 assert.equal(workflow,copy);
});

test('document keeps P0 open and never promotes categorical diagnosis to product approval',()=>{
 for(const phrase of ['#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','No PDF','BLOCK'])
   assert.ok(doc.includes(phrase),phrase);
});
