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
  assert.ok(script.indexOf('analysis result did not appear after tapping Analyze')<script.indexOf('pdf_button = wait_visible'), 'analysis result must precede PDF button');
  assert.match(script,/raise RuntimeError\("PDF share chooser not observed/);
});
test('privacy evidence is synthetic, metadata-only and production is forbidden',()=>{
  assert.match(script,/"syntheticInput": True/);
  assert.match(script,/"stableReleaseAllowed": False/);
  assert.match(script,/No raw UI content is printed/);
  assert.match(workflow,/retention-days: 2/);
  assert.doesNotMatch(workflow,/adb shell screencap|adb logcat|capture-screen|upload.*\.pdf/m);
});
