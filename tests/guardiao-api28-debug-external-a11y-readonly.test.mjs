import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const root='tooling/android/a11y-debug-observer-lab/';
const manifest=readFileSync(root+'app/src/main/AndroidManifest.xml','utf8');
const source=readFileSync(root+'app/src/main/java/com/negresco/a11ydebugobserver/lab/ObserveInstrumentation.java','utf8');
const build=readFileSync(root+'build_observer.sh','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-external-a11y-readonly.yml','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_EXTERNAL_READONLY_OBSERVER.md','utf8');

test('new observer is distinct, testOnly, nonexporting and permissionless',()=>{
  assert.match(manifest,/package="com\.negresco\.a11ydebugobserver\.lab"/);
  assert.match(manifest,/android:targetPackage="com\.negresco\.a11ydebugobserver\.lab"/);
  assert.match(manifest,/android:testOnly="true"/);
  assert.match(manifest,/android:allowBackup="false"/);
  assert.doesNotMatch(manifest,/<uses-permission|<activity|<service|<receiver|<provider/);
});
test('one UiAutomation, one bounded idle wait, exactly three categorical root checks',()=>{
  assert.equal((source.match(/getUiAutomation\(\)/g)||[]).length,1);
  assert.equal((source.match(/waitForIdle\(1000L, 5000L\)/g)||[]).length,1);
  assert.equal((source.match(/getRootInActiveWindow\(\)/g)||[]).length,1);
  assert.match(source,/for \(int i = 1; i <= 3; i\+\+\)/);
  assert.match(source,/DEBUG_PACKAGE\.contentEquals\(root\.getPackageName\(\)\)/);
  assert.match(source,/root\.recycle\(\)/);
  assert.match(source,/catch \(TimeoutException timeout\)/);
  assert.match(source,/finish\(Activity\.RESULT_OK, result\)/);
  assert.doesNotMatch(source,/getText\(|getContentDescription\(|getBoundsInScreen\(|getChild\(|takeScreenshot|injectInputEvent|performAction|startActivity|sendBroadcast|Log\.|System\.out/);
});
test('SDK-only isolated build uses ephemeral key and denies permissions',()=>{
  for(const s of ['--min-api 28','--target-sdk-version 28','openssl rand -hex 16','keytool -genkeypair','-validity 1','aapt2','d8','zipalign','apksigner',"uses-permission:"])
    assert.ok(build.includes(s),s);
  assert.doesNotMatch(build,/curl |wget |gradle |mvn |npm |upload-artifact|gh release/);
});
test('runner checks fresh device, debug digest, foreground and stable PID without actions',()=>{
  for(const s of ['MODE = "idle"','debug.debug_digest()','debug_focus()','before_pid = debug_pid()','after_pid = debug_pid()','installed(DEBUG_PACKAGE)','installed(OBSERVER_PACKAGE)','parse_instrumentation(raw)','("idle-observed", "all-present", "PPP")','BASE.adb("uninstall", pkg','BASE.adb("reverse", "--remove"'])
    assert.ok(runner.includes(s),s);
  assert.equal((runner.match(/"monkey"/g)||[]).length,1);
  assert.equal((runner.match(/"instrument"/g)||[]).length,1);
  assert.doesNotMatch(runner,/input", "tap|input", "swipe|input", "keyevent|uiautomator", "dump|print\(raw|print\(launched|print\(before_pid|print\(after_pid|print\(.*exception|requests\./);
});
test('strict observer parser checks 27 masks and rejects altered or missing proof',()=>{
 const program=[
  'import itertools,sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_external_a11y_readonly_lab as p',
  "for values in itertools.product(('present','null','foreign'),repeat=3):",
  " mask=''.join({'present':'P','null':'N','foreign':'F'}[x] for x in values)",
  " verdict='all-present' if mask=='PPP' else 'some-unconfirmed'",
  " lines=[f'INSTRUMENTATION_RESULT: sample{i}={x}' for i,x in enumerate(values,1)]",
  " lines += ['INSTRUMENTATION_RESULT: mode=idle','INSTRUMENTATION_RESULT: idle=idle-observed',f'INSTRUMENTATION_RESULT: verdict={verdict}','INSTRUMENTATION_CODE: -1']",
  " raw='\\n'.join(lines)",
  " assert p.parse_instrumentation(raw)==('idle-observed',verdict,mask)",
  " assert p.parse_instrumentation(raw.replace('mode=idle','mode=foreign'))==('unconfirmed','unconfirmed','---')",
  " assert p.parse_instrumentation(raw.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0'))==('unconfirmed','unconfirmed','---')",
  " assert p.parse_instrumentation(raw+'\\nINSTRUMENTATION_RESULT: sample1=present')==('unconfirmed','unconfirmed','---')",
  " assert p.parse_instrumentation('\\n'.join(lines[:-1]))==('unconfirmed','unconfirmed','---')",
  " assert p.parse_instrumentation(raw.replace('idle=idle-observed','idle=idle-timeout'))[1]!='all-present'",
  "assert p.parse_instrumentation('')==('unconfirmed','unconfirmed','---')",
  "print('PASS (LAB): all 27 categorical masks gated')"
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): all 27 categorical masks gated/);
});
test('workflow is single-branch, API28, debug, never deploys APK or data',()=>{
  for(const s of ['lab/p01-guardiao-api28-debug-external-a11y-readonly-v1','api-level: 28','-no-snapshot','persist-credentials: false','contents: read','assembleDebug','sanitize_guardiao_debug_manifest.py','guardiao_debug_loopback_policy.py','a11y-debug-observer-lab/build_observer.sh','guardiao_api28_debug_external_a11y_readonly_lab.py'])
   assert.ok(workflow.includes(s),s);
  assert.doesNotMatch(workflow,/workflow_dispatch:|schedule:|pull_request:|contents: write|upload-artifact|download-artifact|secrets\.|assembleRelease|app-release.apk/);
});
test('policy excludes product approval, PDF and any financial access',()=>{
 for(const s of ['approvedForProduction=false','stableReleaseAllowed=false','#120','#126','Draft','root', 'No PDF'])
  assert.ok(policy.includes(s),s);
});
