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
'assert all(updated.count(p.mark(phase))==1 for phase in p.RENDER_MARKERS)',
'assert "override fun onLayoutFinished(info: android.print.PrintDocumentInfo" in updated',
'try: p.instrument_source(updated)',
'except ValueError: pass',
'else: raise AssertionError("duplicate patch accepted")',
'try: p.instrument_source(source.replace("document.onWrite(","document.other("))',
'except ValueError: pass',
'else: raise AssertionError("unknown source accepted")',
'module="package expo.modules.print\\n  private suspend fun printToFile(options: PrintOptions): FilePrintResult? {\\n    return withContext(Dispatchers.Main) {\\n      return@withContext suspendCancellableCoroutine { continuation ->\\n        val renderTask = PrintPDFRenderTask(context, options)\\n        renderTask.render(\\n"',
'module_updated=p.instrument_module_source(module)',
'assert all(module_updated.count(p.mark(phase))==1 for phase in p.MODULE_MARKERS)',
'assert p.classify_log("I/NegrescoPdfPhaseLab: native-module-entered")=="native-module-entered"',
'assert p.classify_log("I NegrescoPdfPhaseLab: native-module-render-dispatched")=="native-module-render-dispatched"',
'try:p.instrument_module_source(module_updated)',
'except ValueError:pass',
'else:raise AssertionError("duplicate module patch accepted")',
'try:p.instrument_module_source(module.replace("renderTask.render(","renderTask.other("))',
'except ValueError:pass',
'else:raise AssertionError("unexpected module source accepted")',
'assert b"native-module-entered" in p.DEX_REQUIRED',
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

test('persistent Debug phase marker only accepts a unique exact TextView',()=>{
 const py=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_pdf_debug_metro_lab as p',
  'm=p.VISUAL_SHARE_MARKER',
  'a={"class":"android.widget.TextView","content-desc":m,"text":m}',
  'assert p.exact_visual_share_marker([a])',
  'assert p.exact_visual_share_marker([{"class":"android.widget.TextView","text":m}])',
  'assert not p.exact_visual_share_marker([])',
  'assert not p.exact_visual_share_marker([{"class":"android.view.View","text":m}])',
  'assert not p.exact_visual_share_marker([{"class":"android.widget.TextView","text":m+" spoof"}])',
  'assert not p.exact_visual_share_marker([a,dict(a)])',
  'print("PASS: exact visual evidence only")'
 ].join('\n');
 const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: exact visual evidence only');
});

test('post-receipt visual search stays bounded and cannot fabricate PASS',()=>{
 assert.match(runner,/if exact_visual_share_marker\(base\.xml_nodes\(\)\):/);
 assert.match(runner,/for _ in range\(2\):/);
 assert.match(runner,/for movement in \(base\.scroll_forward_precise, base\.scroll_backward\):/);
 assert.match(runner,/for step in range\(8\):/);
 assert.match(runner,/if confirmed:\s*\n\s*observed\.add\("lab-share-entered-after-receipt"\)/);
 assert.match(runner,/if not observed:\s*\n\s*raise RuntimeError\("no actual debug-only phase marker was observed"\)/);
 assert.doesNotMatch(runner,/native_before_receiver == "native-render-completed"[\s\S]{0,60}observed\.add/);
});

test('Debug post-receiver screen categories do not qualify as visual evidence',()=>{
 const python=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_pdf_debug_metro_lab as p',
  'm=p.VISUAL_SHARE_MARKER',
  'text=lambda s,c="android.widget.TextView":{"class":c,"text":s}',
  'assert p.classify_debug_visual_screen([text(m)])=="visual-share-exact-confirmed"',
  'assert p.classify_debug_visual_screen([text(m,"android.view.View")])=="visual-share-other-class"',
  'assert p.classify_debug_visual_screen([text(m+" extra")])=="visual-share-nonexact"',
  'assert p.classify_debug_visual_screen([text("Gerar e compartilhar relatório PDF")])=="guardiao-export-visible-no-marker"',
  'assert p.classify_debug_visual_screen([text("Relatório de evidências")])=="guardiao-report-visible-no-marker"',
  'assert p.classify_debug_visual_screen([text("Seu universo")])=="app-home-visible"',
  'assert p.classify_debug_visual_screen([text("outra tela")])=="screen-unclassified"',
  'assert not p.exact_visual_share_marker([text(m,"android.view.View")])',
  'assert not p.exact_visual_share_marker([text(m+" extra")])',
  'print("PASS: fixed UI categories cannot spoof a confirmed TextView")'
 ].join('\n');
 const r=spawnSync('python3',['-c',python],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: fixed UI categories cannot spoof a confirmed TextView');
});

test('categorical UI trace is only after PDF evidence and never logs raw XML',()=>{
 const after=runner.indexOf('if not observed:',runner.indexOf('report = json.loads(semantic.REPORT'));
 const probe=runner.indexOf('confirmed = collect_persistent_visual_share_marker()',after);
 assert.ok(after>0&&probe>after);
 assert.match(runner,/print\("ENV \(LAB\): Debug after receiver Back " \+ category, flush=True\)/);
 assert.match(runner,/except \(RuntimeError, subprocess\.TimeoutExpired, ValueError, ET\.ParseError\):\s*\n\s*category = "screen-inspection-unavailable"/);
 assert.match(runner,/return "visual-share-other-class"/);
 assert.match(runner,/return "app-home-visible"/);
 assert.doesNotMatch(runner,/print\(base\.xml_nodes|print\(nodes\)|print\(node\)|screencap|upload-artifact/);
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
 assert.match(source,/MODULE_TARGET = Path\("node_modules\/expo-print\/android\/src\/main\/java\/expo\/modules\/print\/PrintModule\.kt"\)/);
 assert.match(source,/module_updated = instrument_module_source\(MODULE_TARGET\.read_text\(encoding="utf-8"\)\)/);
 assert.match(source,/MODULE_TARGET\.write_text\(module_updated, encoding="utf-8"\)/);
 assert.match(source,/native-module-render-dispatched/);
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

test('WebView renderer exit marker is Debug-only and preserves default handling',()=>{
 const py=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_pdf_native_phase_lab as p',
  'assert "native-render-process-gone" in p.MARKERS',
  'assert b"native-render-process-gone" in p.DEX_REQUIRED',
  'assert p.classify_log("I/NegrescoPdfPhaseLab: native-render-process-gone")=="native-render-process-gone"',
  'assert p.classify_log("I/UntrustedTag: native-render-process-gone")=="native-phase-unconfirmed"',
  'print("PASS: fixed WebView renderer exit category")'
 ].join('\n');
 const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.equal(result.stdout.trim(),'PASS: fixed WebView renderer exit category');
 assert.match(source,/mark\("native-render-process-gone"\)/);
 assert.match(source,/override fun onRenderProcessGone\(view: WebView, detail: android\.webkit\.RenderProcessGoneDetail\): Boolean/);
 assert.match(source,/return super\.onRenderProcessGone\(view, detail\)/);
 assert.doesNotMatch(source,/return true\s*\\n"\s*\+\s*"\s*}\s*\\n"/);
 assert.match(source,/b"native-render-process-gone"/);
 assert.doesNotMatch(release,/native-render-process-gone|onRenderProcessGone/);
});

test('renderer exit observation survives later callbacks without changing any PDF gate',()=>{
 const py=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_pdf_native_phase_lab as p',
  'tag="I/NegrescoPdfPhaseLab: "',
  'before=tag+"native-render-entered"',
  'gone=tag+"native-render-process-gone"',
  'after=tag+"native-render-completed"',
  'assert p.classify_renderer_exit_log(before+"\\n"+gone+"\\n"+after)=="native-renderer-exit-observed"',
  'assert p.classify_renderer_exit_log(before+"\\n"+after)=="native-renderer-exit-not-observed-in-window"',
  'assert p.classify_renderer_exit_log("I/UntrustedTag: native-render-process-gone")=="native-renderer-exit-unconfirmed"',
  'assert p.classify_renderer_exit_log(after+"\\nI/UntrustedTag: native-render-process-gone")=="native-renderer-exit-not-observed-in-window"',
  'assert p.classify_renderer_exit_log("junk"*(p.MAX_CAPTURE+1))=="native-renderer-exit-unconfirmed"',
  'assert p.classify_renderer_exit_log(None)=="native-renderer-exit-unconfirmed"',
  'print("PASS: fixed renderer-exit category survives later native phases")'
 ].join('\n');
 const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.equal(result.stdout.trim(),'PASS: fixed renderer-exit category survives later native phases');
 assert.match(source,/def collect_renderer_exit_category\(\) -> str:/);
 assert.match(source,/native-renderer-exit-not-observed-in-window/);
 assert.match(source,/return "native-renderer-exit-unconfirmed"/);
 assert.equal((runner.match(/native_print_phase\.collect_renderer_exit_category\(\)/g)||[]).length,2);
 assert.match(runner,/ENV \(LAB\): Android Debug native renderer exit /);
 assert.doesNotMatch(release,/collect_renderer_exit_category|native-renderer-exit/);
});
