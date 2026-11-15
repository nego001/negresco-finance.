import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const script = readFileSync('tooling/android/guardiao_debug_pdf_three_api26_lab.py','utf8');
const workflow = readFileSync('.github/workflows/guardiao-debug-pdf-three-api26-lab.yml','utf8');

test('Android 8 comparison is scoped to disposable Debug and three guarded PDFs',()=>{
 assert.match(workflow,/lab\/p01-guardiao-debug-three-pdf-api26-v1/);
 assert.match(workflow,/api-level: 26/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/permissions:\s*\n  contents: read/);
 assert.match(workflow,/guardiao_debug_pdf_three_api26_lab\.py/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|secrets\.|eas update/i);
 assert.match(script,/CYCLES = tuple\("abc"\)/);
 assert.match(script,/require_api26\(\)/);
 assert.match(script,/verify_api26_synthetic_receipt\(/);
 assert.match(script,/verify_extended_semantic_receipt\(semantic\.REPORT\)/);
 assert.match(script,/nav\.navigate_after_verified_pdf\(baseline_pid\)/);
 assert.match(script,/boot\.reset_native_window\(\)/);
 assert.match(script,/semantic\.REPORT\.unlink\(/);
 assert.doesNotMatch(script,/force-stop|pm", "clear"|upload-artifact/i);
});

test('API26 strict receipt and emulator identity reject API28, malformed evidence and data leakage',()=>{
 const py=[
 'import sys,json,tempfile',
 'from pathlib import Path',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_pdf_three_api26_lab as x',
 'with tempfile.TemporaryDirectory() as d:',
 ' p=Path(d)/"receipt.json"',
 ' flags=("syntheticInput","realAndroidApkPdf","nativePdfSemanticTextVerified","receiverCacheClean","privateCaptureDeleted","systemChooserObserved","receiverPdfRead","allPagesRendered")',
 ' base={key:True for key in flags}',
 ' base.update({"api":26,"apkSha256":"a"*64,"sourceFixture":x.retained.EXPECTED_FIXTURE,"approvedForProduction":False,"stableReleaseAllowed":False,"schemaVersion":2,"scope":"SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT","chromeReferenceUsed":False,"pdfPages":1,"textPagesVerified":1,"pdfPageCount":1,"nonblankPages":1,"pdfSizeBytes":1024,"receivedPdfSha256":"b"*64})',
 ' x.debug.base.adb=lambda *a,**kw:"26\\n"',
 ' x.require_api26()',
 ' p.write_text(json.dumps(base))',
 ' x.verify_api26_synthetic_receipt(p,"a"*64)',
 ' x.verify_extended_semantic_receipt(p)',
 ' for wrong in ("28","", "26-other"):',
 '  x.debug.base.adb=lambda *a,**kw:wrong',
 '  try: x.require_api26()',
 '  except RuntimeError as err: assert str(err)=="three-pdf-api26-device-unconfirmed"',
 '  else: raise AssertionError("wrong API accepted")',
 ' for key,val in (("api",28),("api",True),("receiverCacheClean",False),("stableReleaseAllowed",True),("pdfPages",2),("receivedPdfSha256","0"*63)):',
 '  bad=dict(base);bad[key]=val;p.write_text(json.dumps(bad))',
 '  try:',
 '   x.verify_api26_synthetic_receipt(p,"a"*64)',
 '   x.verify_extended_semantic_receipt(p)',
 '  except RuntimeError: pass',
 '  else: raise AssertionError("malformed receipt accepted: "+key)',
 ' p.write_text("{bad")',
 ' try: x.verify_api26_synthetic_receipt(p,"a"*64)',
 ' except RuntimeError: pass',
 ' else: raise AssertionError("malformed JSON accepted")',
 'print("PASS: strict Android 8 synthetic evidence and identity gates")'
 ].join('\n');
 const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: strict Android 8 synthetic evidence and identity gates/);
});
