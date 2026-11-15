import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_debug_pdf_ten_same_pid_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-pdf-ten-same-pid-lab.yml','utf8');

test('ten PDF same-PID proof is restricted to synthetic Android API28 Debug',()=>{
 assert.match(workflow,/lab\/p01-guardiao-debug-ten-pdf-same-pid-v1/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/verify-debug-apk/);
 assert.match(workflow,/sanitize_guardiao_debug_manifest\.py/);
 assert.match(workflow,/guardiao_debug_loopback_policy\.py verify-apk/);
 assert.match(workflow,/guardiao_debug_pdf_ten_same_pid_lab\.py/);
 assert.match(workflow,/permissions:\s*\n  contents: read/);
 assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|upload-artifact|eas update|secrets\./i);
 assert.match(runner,/CYCLES = tuple\("abcdefghij"\)/);
 assert.match(runner,/nav\.navigate_after_verified_pdf\(baseline_pid\)/);
 assert.match(runner,/identity\.observed_single_app_pid\(\)/);
 assert.match(runner,/debug\.base\.adb = reuse_existing_debug_app/);
 assert.match(runner,/if args == \("install", "-r", str\(debug\.base\.APK\)\):/);
 assert.match(runner,/skipped_app_install != 1/);
 assert.match(runner,/retained\.verify_synthetic_debug_receipt\(/);
 assert.match(runner,/verify_extended_semantic_receipt\(semantic\.REPORT\)/);
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

test('ten-cycle synthetic simulation keeps one PID, skips only app reinstall and verifies both fresh receipts',()=>{
 const py=[
  'import sys,json,tempfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_pdf_ten_same_pid_lab as x',
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
  '  dct.update({"api":28,"apkSha256":"a"*64,"sourceFixture":x.retained.EXPECTED_FIXTURE,"approvedForProduction":False,"stableReleaseAllowed":False,"schemaVersion":2,"scope":"SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT","chromeReferenceUsed":False,"pdfPages":1,"textPagesVerified":1,"pdfPageCount":1,"nonblankPages":1,"pdfSizeBytes":1024,"receivedPdfSha256":"b"*64})',
  '  x.semantic.REPORT.write_text(json.dumps(dct))',
  '  calls.append(("pdf",))',
  ' x.semantic.run_lab=fake_pdf',
  ' x.debug.run=lambda:x.semantic.run_lab()',
  ' x.run()',
  ' assert sum(a==("pdf",) for a in calls)==10,calls',
  ' assert sum(a[0]=="install" for a in calls)==1,calls',
  ' assert sum(a[0]=="nav" for a in calls)==9,calls',
  ' assert calls.count(("reset",))==9,calls',
  ' assert not x.semantic.REPORT.exists()',
  'print("PASS: ten independent synthetic receipts retain PID and reject reinstall")'
 ].join('\n');
 const s=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(s.status,0,s.stderr);
 assert.match(s.stdout,/PASS: ten independent synthetic receipts retain PID and reject reinstall/);
});

test('ten-cycle sequence fails closed on PID change, stale native phase or duplicate Debug reinstall',()=>{
 const script=[
  'import sys,json,tempfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_pdf_ten_same_pid_lab as x',
  'for mode in ("changed-pid","stale-native-phase","duplicate-install"):',
  ' with tempfile.TemporaryDirectory() as d:',
  '  x.semantic.REPORT=Path(d)/"receipt.json"',
  '  x.debug.base.APK=Path(d)/"app-debug.apk"',
  '  x.debug.debug_digest=lambda:"a"*64',
  '  x.debug.observe_debug_home_geometry=lambda:None',
  '  calls=[]; pid_probes=[0]; pdf_count=[0]',
  '  def pid():',
  '   pid_probes[0]+=1',
  '   return "9999" if mode=="changed-pid" and pid_probes[0]>2 else "31415"',
  '  x.identity.observed_single_app_pid=pid',
  '  x.nav.navigate_after_verified_pdf=lambda expected:calls.append(("nav",expected))',
  '  x.boot.reset_native_window=lambda:calls.append(("native-reset",))',
  '  x.native.collect_last_phase=lambda:("native-render-completed" if mode=="stale-native-phase" else "native-phase-unconfirmed")',
  '  x.native.verify_diagnostic_channel=lambda:"native-logcat-probe-confirmed"',
  '  x.native.collect_native_phase_progress=lambda:"native-progress-unconfirmed"',
  '  x.native.collect_layout_write_order=lambda:"layout-write-unconfirmed"',
  '  x.debug.base.adb=lambda *args,**kw:calls.append(tuple(args)) or ""',
  '  def pdf():',
  '   x.debug.observe_debug_home_geometry()',
  '   x.debug.base.adb("install","-r",str(x.debug.base.APK))',
  '   if mode=="duplicate-install" and pdf_count[0]==1:',
  '    x.debug.base.adb("install","-r",str(x.debug.base.APK))',
  '   flags=("syntheticInput","realAndroidApkPdf","nativePdfSemanticTextVerified","receiverCacheClean","privateCaptureDeleted","systemChooserObserved","receiverPdfRead","allPagesRendered")',
  '   record={key:True for key in flags}',
  '   record.update({"api":28,"apkSha256":"a"*64,"sourceFixture":x.retained.EXPECTED_FIXTURE,"approvedForProduction":False,"stableReleaseAllowed":False,"schemaVersion":2,"scope":"SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT","chromeReferenceUsed":False,"pdfPages":1,"textPagesVerified":1,"pdfPageCount":1,"nonblankPages":1,"pdfSizeBytes":1024,"receivedPdfSha256":"b"*64})',
  '   x.semantic.REPORT.write_text(json.dumps(record))',
  '   pdf_count[0]+=1',
  '   calls.append(("pdf",))',
  '  x.semantic.run_lab=pdf',
  '  x.debug.run=lambda:x.semantic.run_lab()',
  '  try: x.run()',
  '  except RuntimeError as error:',
  '   expected={"changed-pid":"same-pid-ten-pdf-process-identity-unconfirmed","stale-native-phase":"same-pid-ten-pdf-stale-native-phase","duplicate-install":"same-pid-ten-pdf-install-scope-invalid"}[mode]',
  '   assert str(error)==expected,(mode,str(error))',
  '  else: raise AssertionError("blocked ten-PDF scenario was accepted")',
  '  assert pdf_count[0]==1,(mode,calls)',
  '  assert not x.semantic.REPORT.exists(),mode',
  '  assert sum(c[0]=="install" for c in calls)==1,(mode,calls)',
  '  assert sum(c[0]=="nav" for c in calls)<=1,(mode,calls)',
  'print("PASS: ten-cycle PDF gate blocks PID drift, stale native state and duplicate reinstall")'
 ].join('\n');
 const outcome=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:20000});
 assert.equal(outcome.status,0,outcome.stderr);
 assert.match(outcome.stdout,/PASS: ten-cycle PDF gate blocks PID drift, stale native state and duplicate reinstall/);
});

test('ten-PDF semantic receipt guard rejects inconsistent metadata without opening any PDF',()=>{
 const py=[
  'import sys,json,tempfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_pdf_ten_same_pid_lab as x',
  'base={"schemaVersion":2,"scope":"SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT","chromeReferenceUsed":False,"pdfPages":1,"textPagesVerified":1,"pdfPageCount":1,"nonblankPages":1,"pdfSizeBytes":1024,"receivedPdfSha256":"b"*64}',
  'cases=[("schemaVersion",True),("scope","unverified"),("chromeReferenceUsed",True),("pdfPages",0),("pdfPages",True),("textPagesVerified",2),("pdfPageCount",2),("nonblankPages",0),("pdfSizeBytes",True),("pdfSizeBytes",200),("receivedPdfSha256","B"*64),("receivedPdfSha256","0"*63)]',
  'with tempfile.TemporaryDirectory() as d:',
  ' p=Path(d)/"receipt.json"',
  ' p.write_text(json.dumps(base))',
  ' x.verify_extended_semantic_receipt(p)',
  ' for key,value in cases:',
  '  bad=dict(base);bad[key]=value',
  '  p.write_text(json.dumps(bad))',
  '  try: x.verify_extended_semantic_receipt(p)',
  '  except RuntimeError as err: assert str(err)=="same-pid-ten-pdf-semantic-metadata-unverified",(key,str(err))',
  '  else: raise AssertionError("tampered metadata accepted: "+key)',
  ' p.write_text("not-json")',
  ' try: x.verify_extended_semantic_receipt(p)',
  ' except RuntimeError as err: assert str(err)=="same-pid-ten-pdf-semantic-metadata-unverified"',
  ' else: raise AssertionError("malformed metadata accepted")',
  ' p.unlink()',
  ' try: x.verify_extended_semantic_receipt(p)',
  ' except RuntimeError as err: assert str(err)=="same-pid-ten-pdf-semantic-metadata-unverified"',
  ' else: raise AssertionError("missing metadata accepted")',
  'print("PASS: ten-PDF semantic receipt metadata is fail closed")'
 ].join('\n');
 const s=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(s.status,0,s.stderr);
 assert.match(s.stdout,/PASS: ten-PDF semantic receipt metadata is fail closed/);
});
