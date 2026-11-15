import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_debug_same_process_nav_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-same-process-nav-lab.yml','utf8');

test('same-process navigation is isolated to ephemeral Debug API28 and never publishes',()=>{
  assert.match(workflow,/lab\/p01-guardiao-debug-same-process-nav-v1/);
  assert.match(workflow,/lab\/p01-guardiao-debug-postpdf-late-nav-v1/);
  assert.match(workflow,/lab\/p01-guardiao-debug-postpdf-late-nav-contract-v1/);
  assert.match(workflow,/lab\/p01-guardiao-pdf-post-receipt-nav-v1/);
  assert.doesNotMatch(workflow,/workflow_dispatch|assembleRelease|upload-artifact|secrets\./i);
  assert.match(workflow,/permissions:\s*\n  contents: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/assembleDebug/);
  assert.match(workflow,/guardiao_debug_same_process_nav_lab\.py/);
  assert.match(workflow,/api-level: 28/);
  assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|upload-artifact|contents: write|eas update|expo publish|secrets\./);
  assert.match(runner,/original_run\(\)\s+# One real PDF A/);
  assert.match(runner,/pdf_receipts != 1/);
  assert.match(runner,/debug\.run\(after_verified_debug_pdf=verify_home_after_pdf\)/);
  assert.match(runner,/if pdf_receipts != 1 or not home_returned:/);
  assert.match(runner,/same-process-pid-unconfirmed/);
  assert.doesNotMatch(runner,/print\(\s*(?:nodes|second|first|xml|PID|fixture)\b|screencap|BASE\.adb\("shell", "pm", "clear"|BASE\.adb\("shell", "am", "force-stop"|BASE\.adb\("shell", "input", "swipe"/i);
});

test('home touch target is rejected for thin, offscreen, duplicated or ambiguous navigation',()=>{
 const py=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_same_process_nav_lab as x',
  'names=x.TAB_IDS',
  'bounds=["[0,800][310,900]","[320,800][650,900]","[660,800][1000,900]"]',
  'nodes=[{"resource-id":"p:id/"+n,"bounds":b,"package":"p","clickable":"true","enabled":"true","selected":"false"} for n,b in zip(names,bounds)]',
  'assert x.safe_home_target(nodes,1080,960,"p")== (155,850)',
  'suffixed=[dict(n,**{"resource-id":n["resource-id"]+"-yoga-regular-bottom-regular-placement-inside-root-window-regular-in-viewport"}) for n in nodes]',
  'assert x.safe_home_target(suffixed,1080,960,"p")== (155,850)',
  'bad=[dict(n,**{"resource-id":n["resource-id"]+"-yoga-thin-bottom-regular-placement-inside-root-window-regular-in-viewport"}) for n in nodes]',
  'assert x.safe_home_target(bad,1080,960,"p") is None',
  'assert x.safe_home_target([dict(n,bounds=b) for n,b in zip(nodes,["[0,800][310,815]","[320,800][650,815]","[660,800][1000,815]"])],1080,960,"p") is None',
  'assert x.safe_home_target(nodes[:2],1080,960,"p") is None',
  'assert x.safe_home_target(nodes+[nodes[0]],1080,960,"p") is None',
  'assert x.safe_home_target([dict(nodes[0],selected="true")]+nodes[1:],1080,960,"p") is None',
  'assert x.safe_home_target([dict(nodes[0],package="wrong")]+nodes[1:],1080,960,"p") is None',
  'assert x.safe_home_target([dict(nodes[0],bounds="[0,800][310,955]")]+nodes[1:],1080,960,"p") is None',
  'assert x.safe_home_target(nodes+[{"bounds":"[10,810][300,890]","clickable":"true","enabled":"true"}],1080,960,"p") is None',
  'print("PASS: strict one-tap Debug target gate")',
 ].join('\n');
 const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: strict one-tap Debug target gate/);
});


test('Debug Yoga probe uses fixed onLayout categories without exposing dimensions or logcat',()=>{
 const app=readFileSync('apps/mobile/App.tsx','utf8');
 assert.match(app,/NEGRESCO_LAB_NAV_LAYOUT_/);
 assert.match(app,/recordLabLayout\('bottom',e\.nativeEvent\.layout\.height\)/);
 assert.match(app,/const key=x\.name==='Início'\?'home':x\.name==='Pix'\?'pix':'negresco'/);
 assert.match(app,/recordLabLayout\(key,e\.nativeEvent\.layout\.height\)/);
 assert.match(app,/if\(!__DEV__\)return/);
 assert.match(runner,/def safe_js_nav_layout_category\(\) -> str:/);
 assert.match(runner,/ReactNativeJS:I/);
 assert.match(runner,/js-layout-all-regular/);
 assert.match(runner,/safe_current_testid_layout_category/);
 assert.match(runner,/js_geometry not in \("js-layout-all-regular", "js-layout-log-unconfirmed"\)/);
 assert.match(runner,/live_geometry != "layout-current-testids-confirmed"/);
 assert.match(runner,/debug\.safe_debug_testid_yoga_category\(\)/);
 assert.match(runner,/debug\.safe_debug_bottom_placement_category\(\)/);
 assert.match(runner,/debug\.safe_debug_window_measure_category\(\)/);
 assert.match(runner,/debug\.safe_debug_testid_nav_geometry\(\)/);
 assert.doesNotMatch(runner,/print\(raw\)|print\(.*logcat|upload-artifact/);
});


test('current post-PDF Yoga needs two matching safe testID readings',()=>{
 const py=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_same_process_nav_lab as x',
  'x.time.sleep=lambda t:None',
  'x.debug.safe_debug_testid_yoga_category=lambda:"testid-yoga-all-regular"',
  'x.debug.safe_debug_bottom_placement_category=lambda:"testid-bottom-inside-root"',
  'x.debug.safe_debug_window_measure_category=lambda:"window-three-regular-in-viewport"',
  'x.debug.safe_debug_testid_nav_geometry=lambda:"testid-three-targets-bounded-readonly"',
  'assert x.safe_current_testid_layout_category()=="layout-current-testids-confirmed"',
  'x.debug.safe_debug_testid_yoga_category=lambda:"testid-yoga-some-thin"',
  'assert x.safe_current_testid_layout_category()=="layout-current-testids-unconfirmed"',
  'print("PASS: fresh layout safe and thin blocked")'
 ].join('\n');
 const output=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(output.status,0,output.stderr);
 assert.match(output.stdout,/PASS: fresh layout safe and thin blocked/);
});

test('post-receipt callback runs after real PDF and visual gates, never before',()=>{
 const parent=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
 const start=parent.indexOf('        report = json.loads(semantic.REPORT.read_text(');
 const evidence=parent.indexOf('        if (report.get("api") != 28',start);
 const phase=parent.indexOf('        if not observed:\n            raise RuntimeError("no actual debug-only phase marker was observed")',evidence);
 const callback=parent.indexOf('            after_verified_debug_pdf()',phase);
 const complete=parent.indexOf('        print("PASS (LAB): Debug synthetic PDF received, rendered, checked and erased")',callback);
 assert.ok(start>=0 && start<evidence && evidence<phase && phase<callback && callback<complete,
  'native PDF evidence, visual phase and callback order must stay fail-closed');
 assert.match(parent,/def run\(\*, after_verified_debug_pdf: Callable\[\[\], None\] \| None = None\) -> None:/);
 assert.match(parent,/if after_verified_debug_pdf is not None:\s*\n\s*after_verified_debug_pdf\(\)/);
 assert.match(runner,/if pdf_receipts != 1 or not pid_before or not semantic\.REPORT\.is_file\(\):/);
 assert.match(runner,/home_returned = True/);
 assert.doesNotMatch(runner,/except Exception:\s*\n\s*pass\s*\n\s*home_returned = True/);
});

test('home PID is captured by the launch probe before the post-PDF guard checks it',()=>{
  const stage=runner.split('    def pdf_then_navigate() -> None:')[1]?.split('\n    def verify_home_after_pdf() -> None:')[0];
  assert.ok(stage,'PDF-to-navigation stage must exist');
  const run=stage.indexOf('original_run()  # One real PDF A');
  const pid=stage.indexOf('if not pid_before:');
  const receipt=stage.indexOf('if not semantic.REPORT.is_file():');
  const nav=runner.split('    def verify_home_after_pdf() -> None:')[1]?.split('\n    debug.observe_debug_home_geometry = home_probe')[0];
  assert.ok(run>=0 && run<pid && pid<receipt && nav,
    'launch/PID capture must precede receipt validation');
  assert.ok(!stage.includes('navigate_after_verified_pdf(pid_before)'),
    'return must not run before the parent visual PDF gate');
  assert.ok(nav.includes('navigate_after_verified_pdf(pid_before)'),
    'deferred callback must perform the real guarded Home return');
  assert.match(runner,/def home_probe\(\) -> None:/);
  assert.match(runner,/debug\.observe_debug_home_geometry = home_probe/);
  assert.match(runner,/semantic\.run_lab = pdf_then_navigate/);
});
