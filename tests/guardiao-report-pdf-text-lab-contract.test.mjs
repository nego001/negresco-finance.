import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const flow=readFileSync('.github/workflows/guardiao-report-browser-pdf-text-lab.yml','utf8');
const source=readFileSync('tooling/guardiao_report_pdf_fixture.mjs','utf8');
const checker=readFileSync('tooling/guardiao_report_pdf_text_check.py','utf8');

test('browser PDF lab is branch-only, synthetic and read-only',()=>{
  assert.match(flow,/lab\/p01-guardiao-rendered-pdf-text-fixture-v1/);
  assert.match(flow,/permissions:\s*\n  contents: read/);
  assert.match(flow,/persist-credentials: false/);
  assert.match(flow,/retention-days: 2/);
  assert.match(flow,/path: guardiao-report-pdf-text-receipt\.json/);
  assert.doesNotMatch(flow,/contents: write|workflow_dispatch|secrets\.|eas update|expo publish|gh release|upload.*\.pdf|upload.*\.html|screencap|logcat/);
});

test('fixture generator reuses production-source HTML with only fictitious details',()=>{
  assert.match(source,/from '\.\.\/apps\/mobile\/guardiao\/report\.ts'/);
  assert.match(source,/createLocalReport/);
  assert.match(source,/renderReportHtml/);
  assert.match(source,/legalName:'LABORATORIO FICTICIO LTDA'/);
  assert.match(source,/cnpj:'00000000000000'/);
  assert.match(source,/status:'unavailable'/);
  assert.match(source,/html\.includes\('0'\.repeat\(47\)\)/);
  assert.doesNotMatch(source,/fetch\(|axios|process\.env\.[A-Z].*KEY|createServer|child_process/);
});

test('PDF text auditor requires real Chrome + poppler outputs, with no fallback success',()=>{
  assert.match(checker,/shutil\.which\("google-chrome"\)/);
  assert.match(checker,/shutil\.which\("pdftotext"\)/);
  assert.match(checker,/shutil\.which\("pdfinfo"\)/);
  assert.match(checker,/--print-to-pdf=/);
  assert.match(checker,/pdf\.read_bytes\(\)/);
  assert.match(checker,/pdftotext", "-enc", "UTF-8"/);
  assert.match(checker,/Legitimidade da cobrança: inconclusiva/);
  assert.match(checker,/Nenhuma operação de pagamento foi realizada/);
  assert.match(checker,/str\(pdf\), "-"/);
  assert.match(checker,/0" \* 47/);
  assert.match(checker,/approvedForProduction": False/);
  assert.match(checker,/stableReleaseAllowed": False/);
  assert.doesNotMatch(checker,/print\(text\)|print\(source\)|upload|requests\.|urllib\.request|subprocess\.run\(\["curl"/);
});
