import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const src=readFileSync('tooling/android/guardiao_api28_debug_home_readiness_census_lab.py','utf8');
const obs=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-home-readiness-census.yml','utf8');
const baseline=readFileSync('.github/workflows/guardiao-api28-debug-targetid-presence.yml','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_HOME_READINESS_CENSUS.md','utf8');

test('M64 observes only after exact PPP, with fixed private Metro categories',()=>{
 const gate=obs.indexOf('if (idle, verdict, mask) != ("idle-observed", "all-present", "PPP")');
 const transport=obs.indexOf('transport = relay.category()');
 const callback=obs.indexOf('after_verified_observation()');
 const after=obs.indexOf('if debug_pid() != before_pid or not debug_focus():');
 assert.ok(gate >= 0 && transport > gate && callback > transport && after > callback);
 assert.match(obs,/device-debug-bundle-http-200/);
 assert.match(obs,/if transport not in allowed_transport:/);
 assert.match(src,/observer\.run\(after_verified_observation=passive_home_census\)/);
 assert.doesNotMatch(src,/input", "tap|input", "swipe|input", "keyevent|swipe\(|tap_node|performAction|scroll_forward|scroll_backward/);
});
test('single snapshot has separate fixed allowlisted diagnoses and compulsory cleanup',()=>{
 assert.equal((src.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((src.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 for(const value of ['PAINEL PRINCIPAL','MODO PRÉVIA','Acesso rápido','home-static-all','home-static-partial','home-static-none','home-static-duplicate','home-static-unconfirmed','app-text-and-clickable','app-text-only','app-clickable-only','app-resource-ids-present','app-resource-ids-absent','previous.classify_snapshot'])
   assert.ok(src.includes(value),value);
 assert.match(src,/finally:\s*\n[\s\S]*BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(src,/if \(tab_status, marker_status, home_status\) != \([\s\S]*"tabs-present-bounded", "home-marker-unique", "home-static-all"/);
 assert.doesNotMatch(src,/print\(nodes|print\(raw|print\(.*\btext\b|print\(.*bounds|print\(.*xml|print\(.*\.get\(\"resource-id\"|console\.log/);
});
test('real pure parser separates fixed Home markers, app-owned text/clickables and IDs',()=>{
 const program=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_home_readiness_census_lab as m',
  "def node(**kw): return dict({'package':'com.negresco.finance','resource-id':'','class':'android.widget.TextView','enabled':'true','clickable':'false','text':''},**kw)",
  "static=[node(**{'text':v}) for v in m.HOME_TEXT_MARKERS]",
  "click=node(**{'class':'android.widget.Button','enabled':'true','clickable':'true','resource-id':'com.negresco.finance:id/btn'})",
  "assert m.classify_readiness(static+[click])==('home-static-all','app-text-and-clickable','app-resource-ids-present')",
  "assert m.classify_readiness(static)==('home-static-all','app-text-only','app-resource-ids-absent')",
  "assert m.classify_readiness(static[:1]+[click])==('home-static-partial','app-text-and-clickable','app-resource-ids-present')",
  "assert m.classify_readiness(static+[static[0]])[0]=='home-static-duplicate'",
  "assert m.classify_readiness([click])==('home-static-none','app-clickable-only','app-resource-ids-present')",
  "assert m.classify_readiness([])==('home-static-none','app-no-text-or-clickables','app-resource-ids-absent')",
  "assert m.classify_readiness('bad')==('home-static-unconfirmed','app-structure-unconfirmed','app-resource-ids-unconfirmed')",
  "assert m.classify_readiness([{'package':'com.someone.else','text':'PAINEL PRINCIPAL'}])[0]=='home-static-none'",
  "print('PASS (LAB): M64 fixed-only readiness categories')"
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M64 fixed-only readiness categories/);
});
test('workflow changes only branch labels and one M64 script, no production deployment',()=>{
 for(const value of ['lab/p01-guardiao-api28-debug-home-readiness-census-v1','api-level: 28','-no-snapshot','assembleDebug','contents: read','persist-credentials: false','a11y-debug-observer-lab/build_observer.sh','guardiao_api28_debug_home_readiness_census_lab.py'])
   assert.ok(workflow.includes(value),value);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
 const changes=[
  ['name: Guardiao API28 Debug target-id presence diagnosis after verified PPP','name: Guardiao API28 Debug passive Home readiness census after verified PPP'],
  ['lab/p01-guardiao-api28-debug-targetid-presence-v1','lab/p01-guardiao-api28-debug-home-readiness-census-v1'],
  ['guardiao-debug-targetid-presence-','guardiao-debug-home-readiness-'],
  ['name: Debug target-id count and Home marker categories after PPP (no gestures)','name: Debug Home native fixed-marker census after external PPP (no gestures)'],
  ['name: Classify single Debug nav testID snapshot after verified root PPP','name: Diagnose home content, resource IDs and tab bounds in one snapshot'],
  ['script: python3 tooling/android/guardiao_api28_debug_targetid_presence_lab.py','script: python3 tooling/android/guardiao_api28_debug_home_readiness_census_lab.py']
 ];
 let expected=baseline;
 for(const [a,b] of changes){assert.ok(expected.includes(a));expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
});
test('docs distinguish RN loading vs testID visibility and preserve all safety gates',()=>{
 for(const value of ['#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','No PDF','BLOCK','tabs-all-missing','home-marker-absent','home-static-all','device-debug-bundle-http-200'])
   assert.ok(doc.includes(value),value);
});
