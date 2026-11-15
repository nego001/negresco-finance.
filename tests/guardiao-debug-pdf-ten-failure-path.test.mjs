import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// The entire experiment is synthetic: no emulator, real financial details,
// user-supplied PDFs, Android package changes or production release activity.
test('ten-PDF loop stops on first corrupt or missing receipt and restores wrappers',()=>{
  const python = [
    'import sys,json,tempfile',
    'from pathlib import Path',
    "sys.path.insert(0,'tooling/android')",
    'import guardiao_debug_pdf_ten_same_pid_lab as x',
    'cases=(("bad-hash-first",1,0),("wrong-scope-first",1,0),("invalid-json-first",1,0),("mismatch-second",2,1),("missing-second",2,1))',
    'for mode,expected_pdfs,expected_home in cases:',
    ' with tempfile.TemporaryDirectory() as d:',
    '  x.semantic.REPORT=Path(d)/"synthetic-receipt.json"',
    '  x.debug.base.APK=Path(d)/"fake-debug.apk"',
    '  x.debug.debug_digest=lambda:"a"*64',
    '  x.identity.observed_single_app_pid=lambda:"31415"',
    '  x.native.collect_last_phase=lambda:"native-phase-unconfirmed"',
    '  x.native.verify_diagnostic_channel=lambda:"native-logcat-probe-confirmed"',
    '  x.debug.observe_debug_home_geometry=lambda:None',
    '  calls=[];attempts=[0]',
    '  x.nav.navigate_after_verified_pdf=lambda pid:calls.append(("home",pid))',
    '  x.boot.reset_native_window=lambda:calls.append(("reset",))',
    '  x.debug.base.adb=lambda *args,**kw:calls.append(tuple(args)) or ""',
    '  prior_adb=x.debug.base.adb',
    '  prior_home=x.debug.observe_debug_home_geometry',
    '  def fake_pdf():',
    '   assert not x.semantic.REPORT.exists()',
    '   x.debug.observe_debug_home_geometry()',
    '   x.debug.base.adb("install","-r",str(x.debug.base.APK))',
    '   attempts[0]+=1',
    '   if mode=="missing-second" and attempts[0]==2: return',
    '   flags=("syntheticInput","realAndroidApkPdf","nativePdfSemanticTextVerified","receiverCacheClean","privateCaptureDeleted","systemChooserObserved","receiverPdfRead","allPagesRendered")',
    '   record={field:True for field in flags}',
    '   record.update({"api":28,"apkSha256":"a"*64,"sourceFixture":x.retained.EXPECTED_FIXTURE,"approvedForProduction":False,"stableReleaseAllowed":False,"schemaVersion":2,"scope":"SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT","chromeReferenceUsed":False,"pdfPages":1,"textPagesVerified":1,"pdfPageCount":1,"nonblankPages":1,"pdfSizeBytes":1024,"receivedPdfSha256":"b"*64})',
    '   if mode=="bad-hash-first":record["receivedPdfSha256"]="invalid"',
    '   if mode=="wrong-scope-first":record["scope"]="RELEASE"',
    '   if mode=="mismatch-second" and attempts[0]==2:record["pdfPageCount"]=2',
    '   x.semantic.REPORT.write_text("{" if mode=="invalid-json-first" else json.dumps(record))',
    '  x.semantic.run_lab=fake_pdf',
    '  x.debug.run=lambda:x.semantic.run_lab()',
    '  try: x.run()',
    '  except (RuntimeError,ValueError,json.JSONDecodeError): pass',
    '  else: raise AssertionError("corrupted synthetic receipt unexpectedly accepted: "+mode)',
    '  assert attempts[0]==expected_pdfs,(mode,attempts)',
    '  assert sum(item[0]=="home" for item in calls)==expected_home,(mode,calls)',
    '  assert sum(item[0]=="reset" for item in calls)==expected_home,(mode,calls)',
    '  assert sum(item[0]=="install" for item in calls)==1,(mode,calls)',
    '  assert not x.semantic.REPORT.exists(),mode',
    '  assert x.debug.base.adb is prior_adb,mode',
    '  assert x.debug.observe_debug_home_geometry is prior_home,mode',
    '  assert x.semantic.run_lab is fake_pdf,mode',
    'print("PASS: ten-PDF fault injection blocks and cleans all five synthetic cases")'
  ].join('\n');
  const result=spawnSync('python3',['-c',python],{
    encoding:'utf8',timeout:20000,maxBuffer:256*1024
  });
  assert.equal(result.status,0,
    'ten-PDF fail-closed regression did not complete with a clean exit');
  assert.match(result.stdout,/PASS: ten-PDF fault injection blocks and cleans all five synthetic cases/);
  assert.doesNotMatch(result.stdout,/PASS \(LAB\): ten independent synthetic PDFs in unchanged Debug PID/);
});
