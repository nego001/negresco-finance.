import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root='tooling/android/a11y-persistent-lab/';
const manifest=readFileSync(root+'app/src/main/AndroidManifest.xml','utf8');
const src=readFileSync(root+'app/src/main/java/com/negresco/a11ypersistent/lab/ProbeInstrumentation.java','utf8');
const activity=readFileSync(root+'app/src/main/java/com/negresco/a11ypersistent/lab/ProbeActivity.java','utf8');
const build=readFileSync(root+'build_self_instrumentation.sh','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-persistent-ui-automation-selftest.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_persistent_ui_automation_smoke.py','utf8');

test('synthetic self-instrumentation has zero permissions and no exported Activity',()=>{
 assert.match(manifest,/android:targetPackage="com\.negresco\.a11ypersistent\.lab"/);
 assert.match(manifest,/android:testOnly="true"/);
 assert.match(manifest,/android:exported="false"/);
 assert.doesNotMatch(manifest,/<uses-permission|com\.negresco\.finance/);
 assert.match(runner,/pm", "list", "packages", "com\.negresco\.finance"/);
 assert.doesNotMatch(runner,/pm", "path", "com\.negresco\.finance"/);
});
test('single UiAutomation session samples exactly three roots without details, gestures or retries',()=>{
 assert.equal((src.match(/getUiAutomation\(\)/g)||[]).length,1);
 assert.equal((src.match(/getRootInActiveWindow\(\)/g)||[]).length,1);
 assert.match(src,/for \(int i = 1; i <= 3; i\+\+\)/);
 assert.match(src,/root\.recycle\(\)/);
 assert.match(src,/finish\(Activity\.RESULT_OK, report\)/);
 assert.doesNotMatch(src,/getText\(|getPackageName\(|getContentDescription\(|injectInputEvent|performAction|takeScreenshot|Log\.|Thread\.sleep/);
});
test('stable mode needs observed focus, visibility and real layout before one-time sampling',()=>{
 assert.match(activity,/CountDownLatch\(1\)/);
 for(const s of ['hasWindowFocus()', 'decor.isShown()', 'decor.getWidth() > 0', 'decor.getHeight() > 0', 'awaitVisible'])assert.ok(activity.includes(s),s);
 assert.match(src,/"stabilized"\.equals\(mode\)/);
 assert.match(src,/activity\.awaitVisible\(10000L\)/);
 assert.match(src,/report\.putString\("readiness", "ready"\)/);
 assert.match(src,/report\.putString\("readiness", "not-requested"\)/);
 assert.doesNotMatch(src+activity,/Thread\.sleep|injectInputEvent|performAction/);
});
test('parser reports only the fixed pattern, rejects contradictions, partial and dishonest results',()=>{
 const program=[
  'import sys,itertools',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_persistent_ui_automation_smoke as p',
  "for mode in ('baseline','stabilized'):",
  " for bits in itertools.product(('present','null'), repeat=3):",
  "  verdict='all-present' if all(x=='present' for x in bits) else 'some-null'",
  "  lines=[f'INSTRUMENTATION_RESULT: sample{i}={x}' for i,x in enumerate(bits,1)]",
  "  lines += [f'INSTRUMENTATION_RESULT: mode={mode}',f'INSTRUMENTATION_RESULT: readiness={\"ready\" if mode==\"stabilized\" else \"not-requested\"}',f'INSTRUMENTATION_RESULT: verdict={verdict}','INSTRUMENTATION_CODE: -1']",
  "  raw='\\n'.join(lines)",
  "  mask=''.join('P' if x=='present' else 'N' for x in bits)",
  "  assert p.classify(raw, mode)==(verdict,mask)",
  "  assert p.classify(raw, 'untrusted')==('unconfirmed','---')",
  "  assert p.classify(raw.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0'),mode)==('unconfirmed','---')",
  "  assert p.classify(raw+'\\nINSTRUMENTATION_RESULT: sample1=null',mode)==('unconfirmed','---')",
  "  assert p.classify(raw.replace(f'verdict={verdict}','verdict=invalid'),mode)==('unconfirmed','---')",
  "  assert p.classify(raw.replace(f'mode={mode}','mode=untrusted'),mode)==('unconfirmed','---')",
  "  assert p.classify(raw.replace('sample2=', 'sample2=bad'),mode)==('unconfirmed','---')",
  "  assert p.classify(raw.replace('readiness=', 'readiness=bad'),mode)==('unconfirmed','---')",
  "  assert p.classify('\\n'.join(lines[:-1]),mode)==('unconfirmed','---')",
  "print('PASS (LAB): 16 masks and strict reject fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): 16 masks/);
});
test('SDK-only one-day ephemeral signature and zero-permission gate',()=>{
 for(const s of ['aapt2','d8','zipalign','apksigner','--min-api 28','--target-sdk-version 28','openssl rand -hex 16','keytool -genkeypair'])assert.ok(build.includes(s),s);
 assert.doesNotMatch(build,/curl |wget |gradle |mvn |npm |gh release|upload-artifact/);
});
test('branch-only independent baseline and stable Android9 emulators',()=>{
 for(const s of ['lab/p01-guardiao-api28-persistent-ui-automation-selftest-v1','api: [28]','trial: [1, 2]','mode: [baseline, stabilized]','contents: read','persist-credentials: false','-no-snapshot'])assert.ok(workflow.includes(s),s);
 assert.doesNotMatch(workflow,/com\.negresco\.finance|download-artifact|upload-artifact|contents: write|workflow_dispatch:|schedule:|pull_request:|secrets\./);
 assert.match(workflow,/smoke\.py \$\{\{ matrix\.mode \}\}/);
});
test('bounded codes, masked root sequence, and no raw instrumentation in logs',()=>{
 for(const s of ['STAGE = "startup"','STAGE = "api28-check"','STAGE = "package-preflight"',
  'STAGE = "synthetic-install"','STAGE = "instrumentation-command"',
  'STAGE = "root-verdict"','ENV (LAB): persistent-root-category=',
  'ENV (LAB): persistent-root-pattern=', 'BLOCK + " stage=" + STAGE'])assert.ok(runner.includes(s),s);
 assert.match(runner,/pattern = ""\.join\("P"/);
 assert.doesNotMatch(runner,/print\(result|print\(proc|print\(error|print\(installed|print\(raw|print\(output/);
});
