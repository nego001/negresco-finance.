import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root='tooling/android/a11y-persistent-lab/';
const manifest=readFileSync(root+'app/src/main/AndroidManifest.xml','utf8');
const src=readFileSync(root+'app/src/main/java/com/negresco/a11ypersistent/lab/ProbeInstrumentation.java','utf8');
const build=readFileSync(root+'build_self_instrumentation.sh','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-persistent-ui-automation-selftest.yml','utf8');

test('synthetic self-instrumentation has zero permissions and no exported Activity',()=>{
 assert.match(manifest,/android:targetPackage="com\.negresco\.a11ypersistent\.lab"/);
 assert.match(manifest,/android:testOnly="true"/);
 assert.match(manifest,/android:exported="false"/);
 assert.doesNotMatch(manifest,/<uses-permission|com\.negresco\.finance/);
 const runner=readFileSync('tooling/android/guardiao_api28_persistent_ui_automation_smoke.py','utf8');
 assert.match(runner,/pm", "list", "packages", "com\.negresco\.finance"/);
 assert.doesNotMatch(runner,/pm", "path", "com\.negresco\.finance"/);
});
test('a single UiAutomation session samples three roots without node details or gestures',()=>{
 assert.equal((src.match(/session = getUiAutomation\(\)/g)||[]).length,1);
 assert.equal((src.match(/session\.getRootInActiveWindow\(\)/g)||[]).length,1);
 assert.match(src,/for \(int i = 1; i <= 3; i\+\+\)/);
 assert.match(src,/root\.recycle\(\)/);
 assert.match(src,/finish\(Activity\.RESULT_OK, report\)/);
 assert.doesNotMatch(src,/getText\(|getPackageName\(|getContentDescription\(|injectInputEvent|performAction|takeScreenshot|Log\./);
});
test('instrumentation parser rejects missing and contradictory results',()=>{
 const program=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_persistent_ui_automation_smoke as p',
  "valid='\\n'.join(['INSTRUMENTATION_RESULT: sample1=present','INSTRUMENTATION_RESULT: sample2=present','INSTRUMENTATION_RESULT: sample3=present','INSTRUMENTATION_RESULT: verdict=all-present','INSTRUMENTATION_CODE: -1'])",
  "assert p.classify(valid)=='all-present'",
  "assert p.classify(valid.replace('sample2=present','sample2=null').replace('verdict=all-present','verdict=some-null'))=='some-null'",
  "assert p.classify(valid.replace('sample2=present','sample2=null'))=='unconfirmed'",
  "assert p.classify(valid.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0'))=='unconfirmed'",
  "assert p.classify(valid+'\\nINSTRUMENTATION_RESULT: sample1=present')=='unconfirmed'",
  "assert p.classify('')=='unconfirmed'",
  "print('PASS (LAB): persistent parser fixture')"
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): persistent parser fixture/);
});
test('SDK-only one-day ephemeral signature and zero-permission gate',()=>{
 for(const s of ['aapt2','d8','zipalign','apksigner','--min-api 28','--target-sdk-version 28','openssl rand -hex 16','keytool -genkeypair'])assert.ok(build.includes(s),s);
 assert.doesNotMatch(build,/curl |wget |gradle |mvn |npm |gh release|upload-artifact/);
});
test('branch-only two Android9 reference emulators, no finance APK or upload',()=>{
 for(const s of ['lab/p01-guardiao-api28-persistent-ui-automation-selftest-v1','api: [28]','trial: [1, 2]','contents: read','persist-credentials: false','-no-snapshot'])assert.ok(workflow.includes(s),s);
 assert.doesNotMatch(workflow,/com\.negresco\.finance|download-artifact|upload-artifact|contents: write|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});

test('bounded stage codes and root verdicts do not leak instrumentation output',()=>{
 const runner=readFileSync('tooling/android/guardiao_api28_persistent_ui_automation_smoke.py','utf8');
 for(const s of ['STAGE = "startup"','STAGE = "api28-check"','STAGE = "package-preflight"',
  'STAGE = "synthetic-install"','STAGE = "instrumentation-command"',
  'STAGE = "root-verdict"','ENV (LAB): persistent-root-category=',
  'BLOCK + " stage=" + STAGE'])assert.ok(runner.includes(s),s);
 assert.doesNotMatch(runner,/print\(result|print\(proc|print\(error|print\(installed|print\(raw|print\(output/);
});
