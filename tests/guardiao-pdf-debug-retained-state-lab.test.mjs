import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const runner=readFileSync('tooling/android/guardiao_pdf_debug_retained_state_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-android-debug-retained-state-lab.yml','utf8');
const original=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');

test('three Debug cycles retain app state but require fresh native phase channel and real PDFs',()=>{
 assert.match(workflow,/branches:\s*\n\s+- lab\/p01-guardiao-debug-metro-phase-v1/);
 assert.match(workflow,/name: Guardiao Android 9 Debug retained-state native PDF phases/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/python3 tooling\/android\/guardiao_pdf_debug_retained_state_lab\.py/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/verify-debug-apk/);
 assert.match(workflow,/sanitize_guardiao_debug_manifest\.py/);
 assert.match(workflow,/guardiao_debug_loopback_policy\.py verify-apk/);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|eas update|upload-artifact|secrets\./i);
 assert.match(runner,/CYCLES = \("a", "b", "c"\)/);
 assert.match(runner,/semantic\.run_lab = paired_replay/);
 assert.match(runner,/debug\.run\(\)/);
 assert.match(runner,/finally:\s*\n\s*semantic\.run_lab = original/);
 assert.match(runner,/debug\.base\.adb\("shell", "am", "force-stop"/);
 assert.match(runner,/debug\.base\.adb\("shell", "pidof"/);
 assert.match(runner,/boot\.reset_native_window\(\)/);
 assert.match(runner,/native\.collect_last_phase\(\) != "native-phase-unconfirmed"/);
 assert.match(runner,/Debug native phases not cleared after reset/);
 assert.match(runner,/native\.verify_diagnostic_channel\(\) != "native-logcat-probe-confirmed"/);
 assert.match(runner,/semantic\.observed = None/);
 assert.match(runner,/verify_synthetic_debug_receipt\(semantic\.REPORT, debug\.debug_digest\(\)\)/);
 assert.match(runner,/native\.collect_last_phase\(\)/);
 assert.match(runner,/native\.collect_renderer_exit_category\(\)/);
 assert.match(runner,/Debug retained-state phase progress on BLOCK/);
 assert.match(runner,/native\.collect_native_phase_progress\(\)/);
 assert.match(runner,/Debug retained-state native diagnostic channel on BLOCK/);
 assert.match(runner,/cycle \+ " " \+ native\.verify_diagnostic_channel\(\)/);
 assert.match(runner,/except Exception:[\s\S]*?Debug retained-state native diagnostic channel on BLOCK[\s\S]*?\n\s*raise/);
 assert.match(runner,/semantic\.REPORT\.unlink\(\)/);
 assert.doesNotMatch(runner,/pm", "clear"|base\.adb\("uninstall"|logcat", "-d"|print\([^\n]*(?:\.message|\.stack|raw_(?:pdf|xml)|pdf_bytes|html|uri)/i);
 assert.match(original,/native_print_phase\.collect_last_phase\(\)/);
});

test('synthetic-only Debug receipt gate rejects reused or incomplete evidence',()=>{
 const py=[
 'import json,sys,tempfile',
 'from pathlib import Path',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_pdf_debug_retained_state_lab as x',
 'with tempfile.TemporaryDirectory() as d:',
 '  root=Path(d)',
 '  path=root/"receipt.json"',
 '  def good():',
 '    result={flag:True for flag in ("syntheticInput","realAndroidApkPdf","nativePdfSemanticTextVerified","receiverCacheClean","privateCaptureDeleted","systemChooserObserved","receiverPdfRead","allPagesRendered")}',
 '    result.update({"api":28,"apkSha256":"a"*64,"sourceFixture":x.EXPECTED_FIXTURE,"approvedForProduction":False,"stableReleaseAllowed":False})',
 '    return result',
 '  path.write_text(json.dumps(good()))',
 '  x.verify_synthetic_debug_receipt(path,"a"*64)',
 '  for bad in [dict(good(),api=26),dict(good(),systemChooserObserved=False),dict(good(),apkSha256="b"*64),dict(good(),approvedForProduction=True),dict(good(),sourceFixture="other")]:',
 '    path.write_text(json.dumps(bad))',
 '    try:x.verify_synthetic_debug_receipt(path,"a"*64)',
 '    except RuntimeError: pass',
 '    else:raise AssertionError("unsafe receipt accepted")',
 '  path.unlink()',
 '  try:x.verify_synthetic_debug_receipt(path,"a"*64)',
 '  except RuntimeError:pass',
 '  else:raise AssertionError("missing receipt accepted")',
 'print("PASS: Debug retained-state receipt gate fails closed")'
 ].join('\n');
 const run=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(run.status,0,run.stderr);
 assert.match(run.stdout,/PASS: Debug retained-state receipt gate fails closed/);
});

test('Debug three-cycle pipeline checks process stop and cannot reuse prior receipt',()=>{
 const py=[
 'import json,sys,tempfile',
 'from pathlib import Path',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_pdf_debug_retained_state_lab as x',
 'with tempfile.TemporaryDirectory() as d:',
 '  x.semantic.REPORT=Path(d)/"receipt.json"',
 '  calls=[]',
 '  x.debug.debug_digest=lambda: "a"*64',
 '  x.native.verify_diagnostic_channel=lambda: "native-logcat-probe-confirmed"',
 '  phases=iter(["native-render-completed","native-phase-unconfirmed","native-render-completed","native-phase-unconfirmed","native-render-completed"])',
 '  x.native.collect_last_phase=lambda: next(phases)',
 '  x.native.collect_renderer_exit_category=lambda: "native-renderer-exit-not-observed-in-window"',
 '  x.boot.reset_native_window=lambda: calls.append("reset-log")',
 '  def adb(*args,**kwargs):',
 '    calls.append(tuple(args))',
 '    return ""',
 '  x.debug.base.adb=adb',
 '  def semantic():',
 '    calls.append("export")',
 '    obj={name:True for name in ("syntheticInput","realAndroidApkPdf","nativePdfSemanticTextVerified","receiverCacheClean","privateCaptureDeleted","systemChooserObserved","receiverPdfRead","allPagesRendered")}',
 '    obj.update({"api":28,"apkSha256":"a"*64,"sourceFixture":x.EXPECTED_FIXTURE,"approvedForProduction":False,"stableReleaseAllowed":False})',
 '    x.semantic.REPORT.write_text(json.dumps(obj))',
 '  x.semantic.run_lab=semantic',
 '  x.debug.run=lambda: x.semantic.run_lab()',
 '  x.retained_debug_cycles()',
 '  assert calls.count("export")==3,calls',
 '  assert calls.count("reset-log")==2,calls',
 '  assert ("shell","am","force-stop",x.debug.base.PACKAGE) in calls',
 '  assert "reset-log" in calls',
 '  assert not x.semantic.REPORT.exists()',
 '  calls.clear()',
 '  def blocked(*args,**kwargs):',
 '    calls.append(tuple(args))',
 '    return "44" if args[:2]==("shell","pidof") else ""',
 '  x.debug.base.adb=blocked',
 '  x.semantic.run_lab=semantic',
 '  x.native.collect_last_phase=lambda: "native-render-completed"',
 '  try:x.retained_debug_cycles()',
 '  except RuntimeError as e:assert str(e)=="Debug retained-state app process still live"',
 '  else:raise AssertionError("live process gate accepted")',
 '  assert calls.count("export")==1,calls',
 '  assert not x.semantic.REPORT.exists()',
 'print("PASS: Debug retained-state three-cycle fail-closed gates")'
 ].join('\n');
 const out=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(out.status,0,out.stderr);
 assert.match(out.stdout,/PASS: Debug retained-state three-cycle fail-closed gates/);
});
