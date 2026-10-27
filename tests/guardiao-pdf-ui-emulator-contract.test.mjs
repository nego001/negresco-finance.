import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/guardiao-pdf-ui-emulator-lab.yml','utf8');
const script=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');

test('real Android UI lab is branch-only, read-only and never signs or publishes',()=>{
  assert.match(workflow,/lab\/p01-guardiao-pdf-ui-emulator-26-28-v1/);
  assert.match(workflow,/permissions:\s*\n  contents: read\s*\n  actions: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/contents: write|gh release|workflow_dispatch|eas update|expo publish|stable_signing|secrets\./);
});
test('two old Android emulators install the same exact SHA-pinned APK',()=>{
  assert.match(workflow,/api: \[26, 28\]/);
  assert.match(workflow,/run-id: 40573549033/);
  assert.match(workflow,/668fabea94131b41e5d4e50e3c1a543df2546da295981aefa1b3d77a66c43c88/);
  assert.match(workflow,/download-artifact@v4/);
  assert.match(workflow,/reactivecircus\/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d/);
  assert.match(script,/EXPECTED_SHA = "668fabea94131b41e5d4e50e3c1a543df2546da295981aefa1b3d77a66c43c88"/);
  assert.match(script,/for block in iter\(lambda: file\.read\(1024 \* 1024\), b""\)/);
  assert.doesNotMatch(script,/hashlib\.file_digest/);
});
test('UI runner requires real Guardião flow and system chooser, never fakes a pass',()=>{
  for(const s of ['wait_visible("Guardião"','wait_visible("Linha digitável do boleto"',
  'wait_visible("Analisar estrutura"','wait_visible("Gerar e compartilhar relatório PDF"',
  'chooser_present()','"systemChooserObserved": True'])
    assert.ok(script.includes(s),'missing mandatory UI stage: '+s);
  assert.match(script,/FIXTURE = "0" \* 47/);
  assert.match(script,/if api not in \(26, 28\)/);
  assert.match(script,/synthetic 47-digit boleto was not populated in the EditText/);
  assert.match(script,/wait_visible\("Verificação inconclusiva ou inválida", retries=14, scroll=True\)/);
  assert.match(script,/STAGE \(LAB\): synthetic analysis result visible/);
  const resultGate=script.indexOf('wait_visible("Verificação inconclusiva ou inválida"');
  assert.ok(resultGate>=0&&resultGate<script.indexOf('pdf_button = wait_visible'), 'real analysis output must precede PDF button');
  assert.match(script,/raise RuntimeError\("PDF share chooser not observed/);
});
test('Android UI automation taps enabled clickable ancestor and never blind screen edges',()=>{
  assert.match(script,/nearest_click = props/);
  assert.match(script,/props\["_tap_bounds"\] = \(nearest_click or props\)/);
  assert.match(script,/refusing touch outside safe app viewport/);
  assert.match(script,/stage_summary\("after first Analyze tap"\)/);
  assert.match(script,/tap_node\(button, prefer_label=True\)/);
  assert.match(script,/click_area > 4 \* area/);
  assert.match(script,/stage_summary\("analysis result missing after two bounded taps, no PDF attempted"\)/);
  assert.match(script,/for _ in range\(7\):\s*\n\s+scroll_backward\(\)/);
  assert.match(script,/Fixed boolean allowlist only/);
  assert.doesNotMatch(script,/print\(raw\)|write_text\(raw/);
});
test('privacy evidence is synthetic, metadata-only and production is forbidden',()=>{
  assert.match(script,/"syntheticInput": True/);
  assert.match(script,/"stableReleaseAllowed": False/);
  assert.match(script,/Never print or upload raw UI hierarchy/);
  assert.match(workflow,/retention-days: 2/);
  assert.doesNotMatch(workflow,/adb shell screencap|adb logcat|capture-screen|upload.*\.pdf/m);
});
