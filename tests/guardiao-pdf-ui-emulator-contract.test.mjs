import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/guardiao-pdf-ui-emulator-lab.yml','utf8');
const script=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');

test('real Android UI lab is branch-only, read-only and never signs or publishes',()=>{
  assert.match(workflow,/lab\/p01-guardiao-pdf-minimal-probe-ui-26-28-v1/);
  assert.match(workflow,/permissions:\s*\n  contents: read\s*\n  actions: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/contents: write|gh release|workflow_dispatch|eas update|expo publish|stable_signing|secrets\./);
});
test('two old Android emulators install the same exact SHA-pinned APK',()=>{
  assert.match(workflow,/api: \[26, 28\]/);
  assert.match(workflow,/run-id: 40617164086/);
  assert.match(workflow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
  assert.match(workflow,/download-artifact@v4/);
  assert.match(workflow,/reactivecircus\/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d/);
  assert.match(script,/EXPECTED_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
  assert.match(script,/for block in iter\(lambda: file\.read\(1024 \* 1024\), b""\)/);
  assert.doesNotMatch(script,/hashlib\.file_digest/);
});
test('UI runner requires real Guardião flow and system chooser, never fakes a pass',()=>{
  for(const s of ['wait_visible("Guardião"','wait_visible("Linha digitável do boleto"',
  'wait_visible("Analisar estrutura"','wait_export_button()',
  'chooser_present()','"systemChooserObserved": True'])
    assert.ok(script.includes(s),'missing mandatory UI stage: '+s);
  assert.match(script,/FIXTURE = "0" \* 47/);
  assert.match(script,/if api not in \(26, 28\)/);
  assert.match(script,/synthetic 47-digit boleto was not populated in the EditText/);
  assert.match(script,/wait_visible\("Verificação inconclusiva ou inválida", retries=5, scroll=False\)/);
  assert.match(script,/STAGE \(LAB\): synthetic analysis result visible/);
  const resultGate=script.indexOf('wait_visible("Verificação inconclusiva ou inválida"');
  assert.ok(resultGate>=0&&resultGate<script.indexOf('pdf_button = wait_export_button()'), 'real analysis output must precede PDF button');
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
test('previously observed invalid boleto analysis must not be scrolled out and invalidated',()=>{
  assert.match(script,/def stage_summary\(label: str\) -> dict\[str, bool\]:/);
  assert.match(script,/return visible/);
  assert.match(script,/observed = first\["Verificação inconclusiva ou inválida"\]/);
  assert.match(script,/observed = retry\["Verificação inconclusiva ou inválida"\]/);
  assert.match(script,/if not observed:[\s\S]*wait_visible\("Verificação inconclusiva ou inválida", retries=6, scroll=False\)/);
  assert.doesNotMatch(script,/wait_visible\("Verificação inconclusiva ou inválida", retries=14, scroll=True\)/);
  assert.match(script,/analysis result was never observed; do not export PDF/);
});
test('real PDF stage cannot skip thin button or treat sharing failure as pass',()=>{
  assert.match(script,/def wait_export_button\(\) -> dict\[str, str\]:/);
  assert.match(script,/for step in range\(48\):/);
  assert.match(script,/scroll_forward_precise\(\)/);
  assert.match(script,/PDF button not visible after 48 small scroll steps/);
  assert.match(script,/tap_node\(pdf_button, prefer_label=True\)/);
  assert.match(script,/one bounded PDF export tap dispatched/);
  assert.match(script,/if chooser_present\(\):/);
  assert.match(script,/Guardião PDF native failure phase:/);
  assert.match(script,/Guardião reported Android PDF sharing unavailable/);
  assert.match(script,/PDF chooser timeout; no app status is treated as success/);
});
test('laboratory phase feedback is fixed only, no native exception messages or PDF content',()=>{
  for(const phase of ['print','invalid-uri','availability','share'])
    assert.ok(script.includes('"' + phase + '"'),'missing coarse phase '+phase);
  for(const label of [
    'Falha ao gerar o PDF local.',
    'O arquivo PDF gerado não tem um endereço local válido.',
    'Falha ao verificar o compartilhamento disponível.',
    'Falha ao abrir o compartilhamento nativo do Android.'
  ])assert.ok(script.includes(label));
  assert.match(script,/Deliberately no dynamic error text, no screenshots, no PDF upload/);
  assert.doesNotMatch(script,/print\(exc\.args\)|print\(raw\)|subprocess\.run\(.*logcat/);
});
test('minimal-PDF A/B verdict is never interpreted as successful export',()=>{
  for(const [label,code] of [
    ['Falha ao gerar o relatório PDF. Teste sintético mínimo criou arquivo local.','report-failed-minimal-created'],
    ['Falha ao gerar o relatório PDF. Teste sintético mínimo também falhou.','report-failed-minimal-failed'],
    ['Falha ao gerar o PDF local. Teste sintético sem resultado verificável.','report-failed-minimal-unverified']
  ]) {
    assert.ok(script.includes(label),'missing fixed non-sensitive message');
    assert.ok(script.includes(code),'missing blocked diagnostic outcome');
  }
  assert.match(script,/All three probe verdicts are BLOCK outcomes for the real report/);
  assert.match(script,/raise RuntimeError\("Guardião synthetic A\/B result: " \+ verdict\)/);
  assert.doesNotMatch(script,/print\(result\.uri\)|print\(.*?report_html\)/);
});
test('privacy evidence is synthetic, metadata-only and production is forbidden',()=>{
  assert.match(script,/"syntheticInput": True/);
  assert.match(script,/"stableReleaseAllowed": False/);
  assert.match(script,/Never print or upload raw UI hierarchy/);
  assert.match(workflow,/retention-days: 2/);
  assert.doesNotMatch(workflow,/adb shell screencap|adb logcat|capture-screen|upload.*\.pdf/m);
});
