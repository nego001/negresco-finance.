import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('tooling/android/guardiao_pdf_native_phase_lab.py','utf8');
const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-android-debug-metro-phase-lab.yml','utf8');
const release=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');

const py=[
'import sys',
"sys.path.insert(0,'tooling/android')",
'import guardiao_pdf_native_phase_lab as p',
'assert p.mark("native-render-entered").endswith(\'"native-render-entered")\')',
'assert p.classify_log("I NegrescoPdfPhaseLab: native-write-finished")=="native-write-finished"',
'assert p.classify_log("I/NegrescoPdfPhaseLab: native-write-finished")=="native-write-finished"',
'assert p.classify_log("I/NegrescoPdfPhaseLab(  585): native-write-finished")=="native-write-finished"',
'assert p.classify_log("I/OtherTag: native-write-finished")=="native-phase-unconfirmed"',
'assert p.classify_log("E/NegrescoPdfPhaseLab: native-write-finished")=="native-phase-unconfirmed"',
'assert p.classify_log("I NegrescoPdfPhaseLab: native-unlisted")=="native-phase-unconfirmed"',
'assert p.classify_log("other: native-write-finished")=="native-phase-unconfirmed"',
'assert p.classify_log("x"*64001)=="native-phase-unconfirmed"',
'source="package expo.modules.print\\n    webView = WebView(context)\\n    override fun onPageFinished(view: WebView, url: String) {\\n      document.onLayout(null, printAttributes, null, object : PrintDocumentAdapterLayoutCallback() {}, null)\\n        document.onWrite(arrayOf(PageRange.ALL_PAGES), fileDescriptor, null, printDocumentWriteCallback)\\n    override fun onWriteFinished(pages: Array<PageRange>) {\\n      callbacks.onRenderFinished(document, outputFile, numberOfPages)\\n    override fun onWriteFailed(error: CharSequence?) {\\n      callbacks.onRenderError(PdfWriteException())\\n    }\\n"',
'updated=p.instrument_source(source)',
'assert all(updated.count(p.mark(phase))==1 for phase in p.MARKERS)',
'assert "override fun onLayoutFinished(info: android.print.PrintDocumentInfo" in updated',
'try: p.instrument_source(updated)',
'except ValueError: pass',
'else: raise AssertionError("duplicate patch accepted")',
'try: p.instrument_source(source.replace("document.onWrite(","document.other("))',
'except ValueError: pass',
'else: raise AssertionError("unknown source accepted")',
'print("PASS: allowlisted native phases, source patch refuses drift")',
].join('\n');

test('native phases and exact SDK54 anchors are synthetic and fail-closed',()=>{
 const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: allowlisted native phases, source patch refuses drift');
});
test('native instrumentation is installed only in disposable Debug build',()=>{
 assert.match(workflow,/python3 \.\.\/\.\.\/tooling\/android\/guardiao_pdf_native_phase_lab\.py install/);
 assert.match(workflow,/assembleDebug/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|workflow_dispatch|eas update|secrets\./i);
 assert.match(source,/node_modules\/expo-print\/android\/src\/main\/java/);
 assert.match(source,/native-layout-finished/);
 assert.match(source,/native-write-cancelled/);
 assert.match(source,/capture_output=True, text=True, timeout=12, check=False/);
 assert.doesNotMatch(source,/print\(result\.stdout\)|write_text\(result\.stdout\)|print\(content\)|upload_file|https?:\/\//i);
 assert.match(runner,/native_print_phase\.collect_last_phase\(\)/);
 assert.match(runner,/native_print_phase\.verify_diagnostic_channel\(\)/);
 assert.match(source,/\["adb", "logcat", "-d", "-v", "tag", "-t", "512"/);
 assert.match(source,/PROBE_TAG = "NegrescoPdfPhaseProbe"/);
 assert.match(source,/secrets\.token_hex\(8\)/);
 assert.match(runner,/nativePdfSemanticTextVerified/);
 assert.match(runner,/receiverCacheClean/);
 assert.match(runner,/approvedForProduction/);
 assert.match(release,/adb\("shell", "svc", "wifi", "disable", check=False\)/);
 assert.doesNotMatch(release,/NegrescoPdfPhaseLab|native-phase-/);
});
