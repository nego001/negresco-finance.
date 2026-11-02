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
test('synthetic APK ZIP scan categorizes multidex including classes10 without exposing data',()=>{
 const code=[
  'import sys,zipfile,tempfile,pathlib',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_pdf_native_phase_lab as p',
  'assert p.DEX_NAMES.fullmatch("classes.dex")',
  'assert p.DEX_NAMES.fullmatch("classes2.dex")',
  'assert p.DEX_NAMES.fullmatch("classes9.dex")',
  'assert p.DEX_NAMES.fullmatch("classes10.dex")',
  'assert p.DEX_NAMES.fullmatch("classes11.dex")',
  'assert not p.DEX_NAMES.fullmatch("classes1.dex")',
  'assert not p.DEX_NAMES.fullmatch("other.dex")',
  'with tempfile.TemporaryDirectory() as tmp:',
  '    apk=pathlib.Path(tmp)/"debug.apk"',
  '    def make(content, name="classes.dex"):',
  '        with zipfile.ZipFile(apk,"w") as z:',
  '            z.writestr(name,content)',
  '    good=b"dex\\n035\\x00"+b"\\x00".join(p.DEX_REQUIRED)',
  '    make(good,"classes10.dex")',
  '    assert p.classify_debug_apk_dex(apk)=="native-dex-hooks-present"',
  '    assert p.verify_debug_apk_dex(apk)',
  '    make(good.replace(b"native-write-finished", b"native-other-finished"))',
  '    assert p.classify_debug_apk_dex(apk)=="native-dex-hooks-partial"',
  '    assert not p.verify_debug_apk_dex(apk)',
  '    make(b"dex\\n035\\x00"+b"unrelated")',
  '    assert p.classify_debug_apk_dex(apk)=="native-dex-hooks-not-observed"',
  '    make(good,"other.bin")',
  '    assert p.classify_debug_apk_dex(apk)=="native-dex-set-unconfirmed"',
  '    make(good[:4])',
  '    assert p.classify_debug_apk_dex(apk)=="native-dex-size-unconfirmed"',
  '    make(b"broken header"+b"\\x00".join(p.DEX_REQUIRED))',
  '    assert p.classify_debug_apk_dex(apk)=="native-dex-header-unconfirmed"',
  '    apk.unlink()',
  '    assert p.classify_debug_apk_dex(apk)=="native-dex-apk-unavailable"',
  'print("PASS: all bounded native DEX categories and multidex indexes covered")',
 ].join('\n');
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: all bounded native DEX categories and multidex indexes covered');
});

test('source-build selector is disposable, scoped to expo-print and fails closed',()=>{
 const code=[
  'import sys,json,tempfile,pathlib',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_pdf_native_phase_lab as p',
  'with tempfile.TemporaryDirectory() as tmp:',
  '  pkg=pathlib.Path(tmp)/"package.json"',
  '  pkg.write_text(json.dumps({"dependencies":{"expo-print":"~15.0.7","expo":"~54.0.0"}}))',
  '  p.configure_expo_print_from_source(pkg)',
  '  data=json.loads(pkg.read_text())',
  '  assert data["expo"]["autolinking"]["android"]["buildFromSource"]==["expo-print"]',
  '  p.configure_expo_print_from_source(pkg)',
  '  assert json.loads(pkg.read_text())==data',
  '  pkg.write_text(json.dumps({"dependencies":{"expo-print":"~15.0.7"},"expo":{"autolinking":{"android":{"buildFromSource":["expo-screen-capture"]}}}}))',
  '  p.configure_expo_print_from_source(pkg)',
  '  assert json.loads(pkg.read_text())["expo"]["autolinking"]["android"]["buildFromSource"]==["expo-screen-capture","expo-print"]',
  '  pkg.write_text(json.dumps({"dependencies":{"expo-print":"~15.0.7"},"expo":{"autolinking":{"android":{"buildFromSource":"all"}}}}))',
  '  try: p.configure_expo_print_from_source(pkg)',
  '  except ValueError: pass',
  '  else: raise AssertionError("malformed source build selector accepted")',
  '  pkg.write_text(json.dumps({"dependencies":{"expo":"~54.0.0"}}))',
  '  try: p.configure_expo_print_from_source(pkg)',
  '  except ValueError: pass',
  '  else: raise AssertionError("missing expo-print accepted")',
  'print("PASS: source build selector isolated and idempotent")',
 ].join('\n');
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: source build selector isolated and idempotent');
});

test('native instrumentation is installed only in disposable Debug build',()=>{
 assert.match(workflow,/python3 \.\.\/\.\.\/tooling\/android\/guardiao_pdf_native_phase_lab\.py install/);
 assert.match(workflow,/python3 \.\.\/\.\.\/tooling\/android\/guardiao_pdf_native_phase_lab\.py source-build/);
 assert.match(source,/def configure_expo_print_from_source\(path: Path = PACKAGE_JSON\) -> None:/);
 assert.match(source,/android\.setdefault\("buildFromSource", \[\]\)/);
 assert.match(source,/existing\.append\("expo-print"\)/);
 assert.doesNotMatch(workflow,/npm publish|eas update|assembleRelease|bundleRelease|upload-artifact/);
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
 assert.match(workflow,/python3 tooling\/android\/guardiao_pdf_native_phase_lab\.py verify-debug-apk/);
 assert.match(source,/def verify_debug_apk_dex\(path: Path\) -> bool:/);
 assert.match(source,/MAX_DEX_ENTRY_BYTES = 96 \* 1024 \* 1024/);
 assert.match(source,/native-render-completed/);
 assert.match(runner,/native_before_receiver: str \| None = None/);
 assert.match(runner,/if chooser_visible and native_before_receiver is None:/);
 assert.match(runner,/native_before_receiver = native_print_phase\.collect_last_phase\(\)/);
 assert.match(runner,/if not observed:\n            raise RuntimeError\("no actual debug-only phase marker was observed"\)/);
 assert.match(runner,/report\.get\("nativePdfSemanticTextVerified"\) is not True/);

 assert.match(runner,/nativePdfSemanticTextVerified/);
 assert.match(runner,/receiverCacheClean/);
 assert.match(runner,/approvedForProduction/);
 assert.match(release,/adb\("shell", "svc", "wifi", "disable", check=False\)/);
 assert.doesNotMatch(release,/NegrescoPdfPhaseLab|native-phase-/);
});
