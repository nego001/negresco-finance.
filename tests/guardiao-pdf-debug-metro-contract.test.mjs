import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/guardiao-android-debug-metro-phase-lab.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');

test('Debug Metro lab is branch-only, private, nonpublishing, without credentials',()=>{
  assert.match(workflow,/lab\/p01-guardiao-debug-metro-phase-v1/);
  assert.match(workflow,/permissions:\s*\n  contents: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/assembleDebug/);
  assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|upload-artifact|publish_release|gh release|contents: write|secrets\.|stable_signing|expo publish|eas update/);
  assert.match(workflow,/reactivecircus\/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d/);
  assert.match(workflow,/api-level: 28/);
});

test('new debug APK must have local SHA, signing and permission gate',()=>{
  assert.match(workflow,/apksigner" verify --verbose/);
  assert.match(workflow,/application-debuggable/);
  assert.match(workflow,/sha256sum "\$APK" > \/tmp\/negresco-debug-test-apk\.sha256/);
  assert.match(runner,/def debug_digest\(\) -> str:/);
  assert.match(runner,/MAX_APK_BYTES = 256 \* 1024 \* 1024/);
  assert.match(runner,/if digest != expected\.group\(1\):/);
  assert.match(workflow,/android\.permission\.READ_MEDIA_IMAGES/);
  assert.match(workflow,/android\.permission\.SYSTEM_ALERT_WINDOW/);
});

test('Android PDF test requires actual local Metro, real receiver and fixed dev marker',()=>{
  assert.match(runner,/socket\.create_connection\(\("127\.0\.0\.1", BUNDLE_PORT\)/);
  assert.match(runner,/def prewarm_android_bundle\(\) -> None:/);
  assert.match(runner,/http\.client\.HTTPConnection\("127\.0\.0\.1", BUNDLE_PORT, timeout=210\)/);
  assert.match(runner,/node_modules\/expo\/AppEntry\.bundle\?platform=android&dev=true&minify=false/);
  assert.match(runner,/response\.status != 200 or "javascript" not in content_type/);
  assert.match(runner,/response\.read\(1\)/);
  assert.match(runner,/server = start_local_metro\(\)\s+prewarm_android_bundle\(\)\s+relay = transport\.PrivateMetroRelay\(\)\s+relay\.start\(\)\s+base\.adb\("reverse"/);

  assert.match(runner,/env\.update\(\{"CI": "1", "EXPO_NO_TELEMETRY": "1", "EXPO_OFFLINE": "1"\}\)/);
  assert.match(runner,/\["npx", "expo", "start", "--localhost", "--port", str\(BUNDLE_PORT\)\]/);
  assert.doesNotMatch(runner,/\["npx", "expo", "start", "--offline", "--localhost"/);

  assert.match(runner,/base\.adb\("reverse", f"tcp:\{BUNDLE_PORT\}", f"tcp:\{transport\.LISTEN_PORT\}"/);
  assert.match(runner,/base\.chooser_present = observe_before_chooser/);
  assert.match(runner,/semantic\.run_lab\(\)/);
  assert.match(runner,/if not observed:/);
  assert.match(runner,/nativePdfSemanticTextVerified/);
  assert.match(runner,/receiverCacheClean/);
  assert.match(runner,/approvedForProduction/);
  assert.match(runner,/stableReleaseAllowed/);
  assert.match(runner,/semantic\.REPORT\.unlink\(missing_ok=True\)/);
  assert.match(runner,/os\.killpg\(server\.pid, signal\.SIGTERM\)/);
  assert.doesNotMatch(runner,/logcat|screencap|print\(.*(?:html|uri|xml|exception|digest|FIXTURE)/i);
});

test('all diagnostics use fixed source categories and no external input data',()=>{
  for(const category of ['lab-print-pending','lab-availability-pending','lab-share-pending'])
    assert.ok(runner.includes(category));
  assert.match(runner,/FIXTURE = "8" \+ "0" \* 47/);
  assert.doesNotMatch(runner,/input\(|argparse|sys\.argv\[1\]|requests\.|HttpURLConnection/);
});

test('prewarm never prints JS and preserves fail-closed local-only policy',()=>{
  assert.match(runner,/conn\.request\("GET", path, headers=\{"Host": "localhost"\}\)/);
  assert.match(runner,/print\("BLOCK STAGE \(LAB\): private Android JS bundle not served"/);
  assert.match(runner,/conn\.close\(\)/);
  assert.match(runner,/ENV \(LAB\): private Metro process/);
  assert.doesNotMatch(runner,/print\(.*response\.read|print\(.*content_type|urllib\.request|https:\/\/|logcat|screencap/i);
});
