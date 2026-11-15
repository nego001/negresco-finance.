import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_debug_pdf_three_same_pid_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-pdf-three-same-pid-lab.yml','utf8');

test('three PDF same-PID proof is restricted to synthetic Android API28 Debug',()=>{
 assert.match(workflow,/lab\/p01-guardiao-debug-three-pdf-same-pid-v1/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/verify-debug-apk/);
 assert.match(workflow,/sanitize_guardiao_debug_manifest\.py/);
 assert.match(workflow,/guardiao_debug_loopback_policy\.py verify-apk/);
 assert.match(workflow,/guardiao_debug_pdf_three_same_pid_lab\.py/);
 assert.match(workflow,/permissions:\s*\n  contents: read/);
 assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|upload-artifact|eas update|secrets\./i);
 assert.match(runner,/CYCLES = \("a", "b", "c"\)/);
 assert.match(runner,/nav\.navigate_after_verified_pdf\(baseline_pid\)/);
 assert.match(runner,/identity\.observed_single_app_pid\(\)/);
 assert.match(runner,/debug\.base\.adb = reuse_existing_debug_app/);
 assert.match(runner,/if args == \("install", "-r", str\(debug\.base\.APK\)\):/);
 assert.match(runner,/skipped_app_install != 1/);
 assert.match(runner,/retained\.verify_synthetic_debug_receipt\(/);
 assert.match(runner,/boot\.reset_native_window\(\)/);
 assert.match(runner,/native\.verify_diagnostic_channel\(\)/);
 assert.match(runner,/semantic\.REPORT\.unlink\(\)/);
 assert.match(runner,/if index < len\(CYCLES\) - 1:/);
 assert.match(runner,/if skipped_app_install or index == 0:/);
 assert.match(runner,/semantic\.run_lab = original_run/);
 assert.doesNotMatch(runner,/pm", "clear"|force-stop|reinstallRelease|print\(raw\)|print\(nodes\)|print\(\s*(?:baseline_pid|now|expected)\b|upload-artifact/i);
 assert.doesNotMatch(runner,/print\([^\n]*(?:str\((?:baseline_pid|now|expected)\)|\+\s*(?:baseline_pid|now|expected)\b)/i);
 assert.match(runner,/print\("PASS \(LAB\): same-PID synthetic PDF receipt cycle "/);
});

test('three-cycle synthetic simulation keeps one PID, skips only app reinstall and verifies both fresh receipts',()=>{
 const py=[
  'import sys,json,tempfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_pdf_three_same_pid_lab as x',
  'with tempfile.TemporaryDirectory() as d:',
  ' x.semantic.REPORT=Path(d)/"receipt.json"',
  ' calls=[]',
  ' x.debug.debug_digest=lambda:"a"*64',
  ' x.identity.observed_single_app_pid=lambda:"31415"',
  ' x.nav.navigate_after_verified_pdf=lambda pid:calls.append(("nav",pid))',
  ' x.boot.reset_native_window=lambda:calls.append(("reset",))',
  ' x.native.collect_last_phase=lambda:"native-phase-unconfirmed"',
  ' x.native.verify_diagnostic_channel=lambda:"native-logcat-probe-confirmed"',
  ' x.debug.observe_debug_home_geometry=lambda:None',
  ' x.debug.base.APK=Path(d)/"app-debug.apk"',
  ' x.debug.base.adb=lambda *args,**kw:calls.append(tuple(args)) or ""',
  ' def fake_pdf():',
  '  assert not x.semantic.REPORT.exists()',
  '  x.debug.observe_debug_home_geometry()',
  '  x.debug.base.adb("install","-r",str(x.debug.base.APK))',
  '  flags=("syntheticInput","realAndroidApkPdf","nativePdfSemanticTextVerified","receiverCacheClean","privateCaptureDeleted","systemChooserObserved","receiverPdfRead","allPagesRendered")',
  '  dct={flag:True for flag in flags}',
  '  dct.update({"api":28,"apkSha256":"a"*64,"sourceFixture":x.retained.EXPECTED_FIXTURE,"approvedForProduction":False,"stableReleaseAllowed":False})',
  '  x.semantic.REPORT.write_text(json.dumps(dct))',
  '  calls.append(("pdf",))',
  ' x.semantic.run_lab=fake_pdf',
  ' x.debug.run=lambda:x.semantic.run_lab()',
  ' x.run()',
  ' assert sum(a==("pdf",) for a in calls)==3,calls',
  ' assert sum(a[0]=="install" for a in calls)==1,calls',
  ' assert sum(a[0]=="nav" for a in calls)==2,calls',
  ' assert calls.count(("reset",))==2,calls',
  ' assert not x.semantic.REPORT.exists()',
  'print("PASS: three independent synthetic receipts retain PID and reject reinstall")'
 ].join('\n');
 const s=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(s.status,0,s.stderr);
 assert.match(s.stdout,/PASS: three independent synthetic receipts retain PID and reject reinstall/);
});
