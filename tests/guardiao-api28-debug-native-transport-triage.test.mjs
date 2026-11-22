import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const triage=readFileSync('tooling/android/guardiao_api28_debug_native_transport_triage_lab.py','utf8');
const home=readFileSync('tooling/android/guardiao_api28_debug_home_readiness_census_lab.py','utf8');
const observer=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-native-transport-triage.yml','utf8');
const baseline=readFileSync('.github/workflows/guardiao-api28-debug-home-readiness-census.yml','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_NATIVE_TRANSPORT_TRIAGE.md','utf8');

test('native bootstrap triage is entered only after externally verified PPP/PID and app Metro snapshot',()=>{
 const gate=observer.indexOf('if (idle, verdict, mask) != ("idle-observed", "all-present", "PPP")');
 const relay=observer.indexOf('transport = relay.category()');
 const callback=observer.indexOf('after_verified_observation()');
 const stable=observer.indexOf('if debug_pid() != before_pid or not debug_focus():');
 assert.ok(gate >= 0 && relay>gate && callback>relay && stable>callback);
 assert.match(triage,/observer\.run\(after_verified_observation=passive_native_transport_triage\)/);
 const boot=triage.indexOf('collect_bootstrap_categories()');
 const ui=triage.indexOf('home.passive_home_census()');
 assert.ok(boot>=0 && ui>boot);
});

test('M65 reuses exactly one mandatory cleanup-protected UI snapshot',()=>{
 assert.equal((triage.match(/xml_nodes\(\)/g)||[]).length,0);
 assert.equal((home.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.match(home,/finally:[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(home,/if \(tab_status, marker_status, home_status\) != \([\s\S]*?"tabs-present-bounded", "home-marker-unique", "home-static-all"/);
 assert.doesNotMatch(triage,/input", "tap|input", "swipe|input", "keyevent|tap_node|scroll_forward|scroll_backward|performAction|\.get\("text"|print\(.*\.get\(/);
});

test('native, permission, reverse and Metro route results are fixed allowlist categories',()=>{
 for(const value of ['internet-permission-granted','native-cleartext-denied','native-js-runtime-error','adb-reverse-confirmed','adb-reverse-absent','probe-tool-unavailable','shell-metro-status-reachable','shell-probe-unavailable','metro-host-property-other-redacted','classify_reverse','safe_category'])
  assert.ok(triage.includes(value),value);
 assert.doesNotMatch(triage,/print\(.*stdout|print\(.*stderr|print\(.*response|print\(.*raw|print\(.*permission_snapshot|print\(.*native_lines|print\(.*XML|print\(.*[.]get\(/);
 assert.match(triage,/SHELL\.probe_shell_routes\(\)/);
 assert.match(triage,/DIAG\.collect_categories\(\)/);
 assert.match(triage,/HOST\.fixed_route_categories\(\)/);
 assert.match(triage,/BASE\.adb\("reverse", "--list", timeout=15, check=False\)/);
});

test('pure reverse parser and sanitizers fail closed on duplicate/malformed or unknown values',()=>{
 const program=[
  'import sys,types',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_native_transport_triage_lab as m',
  "assert m.classify_reverse('emulator-5554 tcp:8081 tcp:18081\\n')=='adb-reverse-confirmed'",
  "assert m.classify_reverse('emulator-5554 tcp:8081 tcp:18081\\nemulator-5556 tcp:8081 tcp:18081')=='adb-reverse-unconfirmed'",
  "assert m.classify_reverse('emulator-5554 tcp:9999 tcp:18081')=='adb-reverse-absent'",
  "assert m.classify_reverse(None)=='adb-reverse-unconfirmed'",
  "assert m.classify_reverse('a'*16385)=='adb-reverse-unconfirmed'",
  "assert m.safe_category('native-cleartext-denied',m.BOOT,'native-startup-unconfirmed')=='native-cleartext-denied'",
  "assert m.safe_category('SENSITIVE ERROR LOG',m.BOOT,'native-startup-unconfirmed')=='native-startup-unconfirmed'",
  "m.DIAG=types.SimpleNamespace(collect_categories=lambda:('internet-permission-granted','native-startup-unconfirmed'))",
  "m.HOST=types.SimpleNamespace(fixed_route_categories=lambda:('metro-host-property-other-redacted','metro-status-reachable','probe-tool-unavailable'))",
  "m.SHELL=types.SimpleNamespace(probe_shell_routes=lambda:('shell-metro-status-reachable','shell-route-unconfirmed'))",
  "m.BASE=types.SimpleNamespace(adb=lambda *a,**kw:'emulator-5554 tcp:8081 tcp:18081')",
  "assert m.collect_bootstrap_categories()==('internet-permission-granted','native-startup-unconfirmed','metro-host-property-other-redacted','adb-reverse-confirmed','metro-status-reachable','probe-tool-unavailable','shell-metro-status-reachable','shell-route-unconfirmed')",
  "m.DIAG=types.SimpleNamespace(collect_categories=lambda: (_ for _ in ()).throw(RuntimeError('private!')))",
  "m.HOST=types.SimpleNamespace(fixed_route_categories=lambda:('raw-secret','raw-secret','raw-secret'))",
  "m.SHELL=types.SimpleNamespace(probe_shell_routes=lambda:('raw-secret','raw-secret'))",
  "m.BASE=types.SimpleNamespace(adb=lambda *a,**kw:None)",
  "values=m.collect_bootstrap_categories()",
  "assert values==('internet-permission-unconfirmed','native-startup-unconfirmed','metro-host-property-unconfirmed','adb-reverse-unconfirmed','route-unconfirmed','route-unconfirmed','shell-probe-unavailable','shell-probe-unavailable')",
  "print('PASS (LAB): M65 fixed native/transport categories')",
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M65 fixed native\/transport categories/);
});

test('M65 workflow reuses all original android Debug-only build, permission, observer and route gates',()=>{
 for(const value of ['lab/p01-guardiao-api28-debug-native-transport-triage-v1','api-level: 28','-no-snapshot','assembleDebug','persist-credentials: false','contents: read','a11y-debug-observer-lab/build_observer.sh','guardiao_api28_debug_native_transport_triage_lab.py'])
   assert.ok(workflow.includes(value),value);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\./);
 const changes=[
  ['name: Guardiao API28 Debug passive Home readiness census after verified PPP','name: Guardiao API28 Debug native bootstrap and Metro transport triage after PPP'],
  ['lab/p01-guardiao-api28-debug-home-readiness-census-v1','lab/p01-guardiao-api28-debug-native-transport-triage-v1'],
  ['guardiao-debug-home-readiness-','guardiao-debug-native-transport-'],
  ['name: Debug Home native fixed-marker census after external PPP (no gestures)','name: Debug native startup, Metro routes and Home census after PPP (no gestures)'],
  ['name: Diagnose home content, resource IDs and tab bounds in one snapshot','name: Diagnose native Metro routes and a single Debug Home snapshot after PPP'],
  ['script: python3 tooling/android/guardiao_api28_debug_home_readiness_census_lab.py','script: python3 tooling/android/guardiao_api28_debug_native_transport_triage_lab.py'],
 ];
 let expected=baseline;
 for(const [a,b] of changes){assert.ok(expected.includes(a),a);expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
});

test('policy keeps sample size and production/PDF safety failures explicit',()=>{
 for(const value of ['#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','BLOCK','PPP','No click or PDF','Shell-UID reachability never proves app-UID reachability'])
   assert.ok(doc.includes(value),value);
});
