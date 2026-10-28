import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectBoleto} from '../apps/mobile/guardiao/validator.ts';
import {createLocalReport,renderReportHtml} from '../apps/mobile/guardiao/report.ts';

const runner=readFileSync('tooling/android/guardiao_android_collection48_invalid_pdf_emulator_smoke.py','utf8');
const semantic=readFileSync('tooling/android/guardiao_android_export_pdf_text_emulator_smoke.py','utf8');
const flow=readFileSync('.github/workflows/guardiao-android-collection48-pdf-text-lab.yml','utf8');
const SYNTHETIC='8'+'0'.repeat(47);

test('48-digit synthetic collection fixture is mathematically invalid, not a payable reference',()=>{
  assert.equal(SYNTHETIC.length,48);
  const analysis=inspectBoleto(SYNTHETIC);
  assert.equal(analysis.kind,'ARRECADAÇÃO');
  assert.equal(analysis.valid,false);
  assert.match(analysis.explanation,/Identificador de valor ou módulo de verificação desconhecido/);
  const html=renderReportHtml(createLocalReport(analysis,'2026-10-28'));
  assert.match(html,/ARRECADAÇÃO/);
  assert.match(html,/Quantidade de dígitos:<\/strong> 48/);
  assert.match(html,/Legitimidade da cobrança: inconclusiva/);
  assert.equal(html.includes(SYNTHETIC),false);
});

test('runner contains only one fixed 48-digit invalid fixture and reuses the proven Android UI path',()=>{
  assert.match(runner,/FIXTURE = "8" \+ "0" \* 47/);
  assert.match(runner,/len\(FIXTURE\) != 48 or FIXTURE\[2\] != "0"/);
  assert.match(runner,/lab\.base\.FIXTURE = FIXTURE/);
  assert.match(runner,/lab\.run_lab\(\)/);
  assert.doesNotMatch(runner,/input\(|argparse|sys\.argv\[1\]|getenv|fetch\(|requests\./);
});

test('PDF extractor requires the 48-digit type and disclaimers, rejects any arbitrary input',()=>{
  assert.match(semantic,/base\.FIXTURE not in \("0" \* 47, "8" \+ "0" \* 47\)/);
  assert.match(semantic,/\("ARRECADAÇÃO", "Quantidade de dígitos: 48"\)/);
  assert.match(semantic,/"synthetic-48-collection-reference-invalid"/);
  assert.match(semantic,/for expected in EXPECTED \+ scenario_specific:/);
  assert.match(semantic,/for forbidden in FORBIDDEN:/);
  assert.match(semantic,/privateCaptureDeleted": True/);
  assert.match(semantic,/Legitimidade da cobrança: inconclusiva/);
  assert.match(semantic,/Nenhuma operação de pagamento foi realizada/);
});

test('new 48-digit CI is branch-only, exact APK SHA-pinned, metadata-only and read-only',()=>{
  assert.match(flow,/lab\/p01-guardiao-android-invalid-arrecadacao-48-v1/);
  assert.match(flow,/permissions:\s*\n  contents: read\s*\n  actions: read/);
  assert.match(flow,/persist-credentials: false/);
  assert.match(flow,/api: \[26, 28\]/);
  assert.match(flow,/target: google_apis/);
  assert.match(flow,/run-id: 40617164086/);
  assert.match(flow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
  assert.match(flow,/guardiao_android_collection48_invalid_pdf_emulator_smoke\.py/);
  assert.match(flow,/path: guardiao-android-real-pdf-text-receipt\.json/);
  assert.match(flow,/retention-days: 2/);
  assert.doesNotMatch(flow,/contents: write|workflow_dispatch|secrets\.|eas update|expo publish|gh release|path: .*\.pdf|adb pull/);
});
