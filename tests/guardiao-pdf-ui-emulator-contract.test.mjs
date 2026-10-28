import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/guardiao-pdf-ui-emulator-lab.yml','utf8');
const script=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');

test('real Android UI lab is branch-only, read-only and never signs or publishes',()=>{
  assert.match(workflow,/lab\/p01-guardiao-pdf-receiver-integrity-26-28-v1/);
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
test('real Android focus and WebView provider are reported only as fixed categories',()=>{
  assert.match(script,/def safe_environment_summary\(\) -> dict\[str, str \| bool\]:/);
  assert.match(script,/No raw activity or dumpsys text/);
  assert.match(script,/return \{\s*"appProcessAlive": running,/);
  assert.match(script,/"foregroundCategory": focus_category/);
  assert.match(script,/"webViewProvider": provider_category/);
  assert.match(script,/provider_category = "provider-reported"/);
  assert.match(script,/provider_category = "none-reported"/);
  assert.match(script,/print\("ENV \(LAB\): " \+ json\.dumps\(safe_environment_summary\(\), sort_keys=True\)/);
  assert.doesNotMatch(script,/print\(.*(?:activity|details|window|focused)\)/);
});
test('PDF receiver retains SHA-pinned Negresco app on both Google APIs emulator targets',()=>{
  assert.match(workflow,/target: google_apis/);
  assert.doesNotMatch(workflow,/target: default/);
  assert.match(workflow,/api: \[26, 28\]/);
  assert.match(workflow,/run-id: 40617164086/);
  assert.match(workflow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
  assert.match(workflow,/permissions:\s*\n  contents: read\s*\n  actions: read/);
});
test('receiver Android manifest is single exported PDF-only activity with zero permissions',()=>{
  const manifest=readFileSync('tooling/android/pdf-receiver-lab/app/src/main/AndroidManifest.xml','utf8');
  const receiver=readFileSync('tooling/android/pdf-receiver-lab/app/src/main/java/com/negresco/pdfreceiver/lab/ReceiverActivity.java','utf8');
  const gradle=readFileSync('tooling/android/pdf-receiver-lab/app/build.gradle.kts','utf8');
  assert.match(manifest,/android:exported="true"/);
  assert.match(manifest,/android.intent.action.SEND/);
  assert.match(manifest,/android:mimeType="application\/pdf"/);
  assert.match(manifest,/android:allowBackup="false"/);
  assert.match(manifest,/android:usesCleartextTraffic="false"/);
  assert.doesNotMatch(manifest,/<uses-permission/);
  assert.match(gradle,/applicationId = "com.negresco.pdfreceiver.lab"/);
  assert.match(gradle,/minSdk = 26/);
  assert.match(gradle,/targetSdk = 28/);
  assert.match(receiver,/Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(receiver,/!"content"\.equals\(uri\.getScheme\(\)\)/);
  assert.match(receiver,/MAX_BYTES = 8L \* 1024L \* 1024L/);
  assert.match(receiver,/new PdfRenderer\(fd\)/);
  assert.match(receiver,/first\.render\(bmp/);
  assert.match(receiver,/temp\.delete\(\)/);
});
test('receiver validates file header and EOF, outputs only metadata and never logs raw document',()=>{
  const receiver=readFileSync('tooling/android/pdf-receiver-lab/app/src/main/java/com/negresco/pdfreceiver/lab/ReceiverActivity.java','utf8');
  assert.match(receiver,/%PDF-/);
  assert.match(receiver,/%%EOF/);
  assert.match(receiver,/MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(receiver,/"received-rendered"/);
  assert.match(receiver,/private static final String RECEIPT = "receipt.json"/);
  assert.match(receiver,/openFileOutput\(RECEIPT, MODE_PRIVATE\)/);
  assert.doesNotMatch(receiver,/Log\.|System\.out|HttpURLConnection|Socket\(|getExternalFilesDir|WRITE_EXTERNAL_STORAGE/);
});
test('E2E pass requires the separate APK, Android chooser, actual receiver and PdfRenderer receipt',()=>{
  assert.match(workflow,/gradle --project-dir tooling\/android\/pdf-receiver-lab :app:assembleDebug/);
  assert.match(workflow,/Receiver lab APK must declare no permissions/);
  assert.match(script,/adb\("install", "-r", str\(RECEIVER_APK\)/);
  assert.match(script,/if chooser_present\(\):[\s\S]{0,160}receive_from_chooser\(api, digest\)/);
  assert.match(script,/wait_visible\("Negresco PDF Receiver LAB"/);
  assert.match(script,/run-as", RECEIVER_PACKAGE, "cat", "files\/receipt.json"/);
  assert.match(script,/receipt\.get\("status"\) != "received-rendered"/);
  assert.match(script,/receipt\.get\("renderedFirstPage"\)/);
  assert.match(script,/receiverPdfRead": True/);
  assert.match(script,/pdfPageCount": receipt\["pages"\]/);
  assert.match(script,/independent PDF receiver did not produce a verified receipt/);
});
test('privacy evidence is synthetic, metadata-only and production is forbidden',()=>{
  assert.match(script,/"syntheticInput": True/);
  assert.match(script,/"stableReleaseAllowed": False/);
  assert.match(script,/Never print or upload raw UI hierarchy/);
  assert.match(workflow,/retention-days: 2/);
  assert.doesNotMatch(workflow,/adb shell screencap|adb logcat|capture-screen|upload.*\.pdf/m);
});
