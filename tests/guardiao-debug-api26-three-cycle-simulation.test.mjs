import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function pythonCheck(lines) {
  const run = spawnSync('python3', ['-c', lines.join('\n')], {
    encoding:'utf8', timeout:20000, maxBuffer:256*1024
  });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
}

test('Android 8 three-PDF sequence uses one PID, two safe Home returns, and one actual app install',()=>{
 const output=pythonCheck([
  'import sys,json,tempfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_pdf_three_api26_lab as x',
  'with tempfile.TemporaryDirectory() as d:',
  ' x.semantic.REPORT=Path(d)/"receipt.json"',
  ' x.debug.base.APK=Path(d)/"debug.apk"',
  ' x.debug.debug_digest=lambda:"a"*64',
  ' x.identity.observed_single_app_pid=lambda:"31415"',
  ' x.nav.navigate_after_verified_pdf=lambda pid:calls.append(("home",pid))',
  ' x.boot.reset_native_window=lambda:calls.append(("reset",))',
  ' x.native.collect_last_phase=lambda:"native-phase-unconfirmed"',
  ' x.native.verify_diagnostic_channel=lambda:"native-logcat-probe-confirmed"',
  ' x.debug.observe_debug_home_geometry=lambda:None',
  ' calls=[]',
  ' def adb(*args,**kwargs):',
  '  calls.append(tuple(args))',
  '  return "26\\n" if args[:4]==("shell","getprop","ro.build.version.sdk") else ""',
  ' x.debug.base.adb=adb',
  ' before_home=x.debug.observe_debug_home_geometry',
  ' def fake_pdf():',
  '  assert not x.semantic.REPORT.exists()',
  '  x.debug.observe_debug_home_geometry()',
  '  x.debug.base.adb("install","-r",str(x.debug.base.APK))',
  '  flags=("syntheticInput","realAndroidApkPdf","nativePdfSemanticTextVerified","receiverCacheClean","privateCaptureDeleted","systemChooserObserved","receiverPdfRead","allPagesRendered")',
  '  record={key:True for key in flags}',
  '  record.update({"api":26,"apkSha256":"a"*64,"sourceFixture":x.retained.EXPECTED_FIXTURE,"approvedForProduction":False,"stableReleaseAllowed":False,"schemaVersion":2,"scope":"SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT","chromeReferenceUsed":False,"pdfPages":1,"textPagesVerified":1,"pdfPageCount":1,"nonblankPages":1,"pdfSizeBytes":1024,"receivedPdfSha256":"b"*64})',
  '  x.semantic.REPORT.write_text(json.dumps(record))',
  '  calls.append(("pdf",))',
  ' x.semantic.run_lab=fake_pdf',
  ' x.debug.run=lambda **kwargs:x.semantic.run_lab() if kwargs=={"expected_api":26} else (_ for _ in ()).throw(AssertionError("wrong API target"))',
  ' x.run()',
  ' assert calls.count(("pdf",))==3,calls',
  ' assert sum(c[0]=="home" for c in calls)==2,calls',
  ' assert calls.count(("reset",))==2,calls',
  ' assert sum(c[0]=="install" for c in calls)==1,calls',
  ' assert not x.semantic.REPORT.exists()',
  ' assert x.debug.base.adb is adb',
  ' assert x.debug.observe_debug_home_geometry is before_home',
  ' assert x.semantic.run_lab is fake_pdf',
  'print("PASS: API26 three synthetic receipts and two safe returns retained one PID")'
 ]);
 assert.match(output,/PASS: API26 three synthetic receipts and two safe returns retained one PID/);
});

test('Android 8 three-PDF loop rejects PID drift, old native callback, and duplicate reinstall',()=>{
 const output=pythonCheck([
  'import sys,json,tempfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_pdf_three_api26_lab as x',
  'for mode in ("changed-pid","stale-phase","duplicate-install"):',
  ' with tempfile.TemporaryDirectory() as d:',
  '  x.semantic.REPORT=Path(d)/"receipt.json"',
  '  x.debug.base.APK=Path(d)/"debug.apk"',
  '  x.debug.debug_digest=lambda:"a"*64',
  '  x.debug.observe_debug_home_geometry=lambda:None',
  '  probes=[0];attempts=[0];calls=[]',
  '  def pid():',
  '   probes[0]+=1',
  '   return "9999" if mode=="changed-pid" and probes[0]>2 else "31415"',
  '  x.identity.observed_single_app_pid=pid',
  '  x.nav.navigate_after_verified_pdf=lambda expected:calls.append(("home",expected))',
  '  x.boot.reset_native_window=lambda:calls.append(("reset",))',
  '  x.native.collect_last_phase=lambda:("native-render-completed" if mode=="stale-phase" else "native-phase-unconfirmed")',
  '  x.native.verify_diagnostic_channel=lambda:"native-logcat-probe-confirmed"',
  '  x.native.collect_native_phase_progress=lambda:"native-progress-unconfirmed"',
  '  x.native.collect_layout_write_order=lambda:"layout-write-unconfirmed"',
  '  def adb(*args,**kwargs):',
  '   calls.append(tuple(args))',
  '   return "26\\n" if args[:4]==("shell","getprop","ro.build.version.sdk") else ""',
  '  x.debug.base.adb=adb',
  '  def fake_pdf():',
  '   x.debug.observe_debug_home_geometry()',
  '   x.debug.base.adb("install","-r",str(x.debug.base.APK))',
  '   if mode=="duplicate-install" and attempts[0]==1:',
  '    x.debug.base.adb("install","-r",str(x.debug.base.APK))',
  '   flags=("syntheticInput","realAndroidApkPdf","nativePdfSemanticTextVerified","receiverCacheClean","privateCaptureDeleted","systemChooserObserved","receiverPdfRead","allPagesRendered")',
  '   record={key:True for key in flags}',
  '   record.update({"api":26,"apkSha256":"a"*64,"sourceFixture":x.retained.EXPECTED_FIXTURE,"approvedForProduction":False,"stableReleaseAllowed":False,"schemaVersion":2,"scope":"SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT","chromeReferenceUsed":False,"pdfPages":1,"textPagesVerified":1,"pdfPageCount":1,"nonblankPages":1,"pdfSizeBytes":1024,"receivedPdfSha256":"b"*64})',
  '   x.semantic.REPORT.write_text(json.dumps(record))',
  '   attempts[0]+=1',
  '  x.semantic.run_lab=fake_pdf',
  '  x.debug.run=lambda **kwargs:x.semantic.run_lab() if kwargs=={"expected_api":26} else (_ for _ in ()).throw(AssertionError("wrong API target"))',
  '  try: x.run()',
  '  except RuntimeError: pass',
  '  else: raise AssertionError("unsafe API26 loop falsely passed "+mode)',
  '  assert attempts[0]==1,(mode,attempts)',
  '  assert sum(c[0]=="install" for c in calls)==1,(mode,calls)',
  '  assert not x.semantic.REPORT.exists(),mode',
  '  assert x.debug.base.adb is adb,mode',
  'print("PASS: API26 loop blocks three process and native-state regressions")'
 ]);
 assert.match(output,/PASS: API26 loop blocks three process and native-state regressions/);
});
