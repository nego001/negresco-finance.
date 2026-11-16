import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const wf=readFileSync('.github/workflows/guardiao-v5-owned-uri-pdf-cross-api.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_owned_uri_v5_cross_api_pdf_lab.py','utf8');
const app=readFileSync('apps/mobile/App.tsx','utf8');
const flow=readFileSync('apps/mobile/guardiao/pdfExport.ts','utf8');

test('workflow fixes immutable new APK bytes, source build identity and independent API26/28 tests',()=>{
 assert.match(wf,/run-id: 43789332636/);
 assert.match(wf,/0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4/g);
 assert.match(wf,/name: negresco-finance-v313-security-preview/);
 assert.match(wf,/name: Guardiao v5 owned PDF URI cross API native receiver/);
 assert.match(wf,/branches:\s*\n\s*- lab/p01-guardiao-v5-owned-uri-real-pdf-api26-api28-v1/);
 assert.match(wf,/api: \[26, 28\]/);
 assert.match(wf,/trial: \[1, 2\]/);
 assert.match(wf,/fail-fast: false/);
 assert.match(wf,/api-level: \$\{\{ matrix\.api \}\}/);
 assert.match(wf,/script: python3 tooling\/android\/guardiao_owned_uri_v5_cross_api_pdf_lab\.py/);
 assert.match(wf,/CN=Android Debug/);
 assert.match(wf,/sha256sum --check --strict/g);
 assert.match(wf,/persist-credentials: false/);
 assert.match(wf,/contents: read/);
 assert.match(wf,/actions: read/);
 assert.match(wf,/build_receiving_apk\.sh/);
 assert.match(wf,/pdftotext/);
 assert.doesNotMatch(wf,/contents: write|continue-on-error: true|\|\| true|assembleRelease|assembleDebug|upload-artifact|publish_release|stable_signing|workflow_dispatch:|pull_request:|eas update|secrets\./i);
});

test('v5 wrapper swaps only exact pin in real independent v4 PDF receiver and rejects historical SHA',()=>{
 assert.match(runner,/NEW_SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"/);
 assert.match(runner,/PREVIOUS_SHA = "3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6"/);
 assert.match(runner,/HISTORICAL_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(runner,/base_candidate\.PINNED_CANDIDATE = NEW_SHA/);
 assert.match(runner,/base_candidate\.candidate_identity\(base_candidate\.APK\)/);
 assert.match(runner,/api26\.run\(\)/);
 assert.match(runner,/base_candidate\.run\(\)/);
 assert.match(runner,/base_candidate\.semantic\.ensure_absent\(\)/);
 assert.match(runner,/actual_api not in \{"26", "28"\}/);
 assert.match(runner,/BLOCK \(PRODUCTION\): historical APK untested, candidate debug signed/);
 const v4=readFileSync('tooling/android/guardiao_candidate_release_root_v4_api28_pdf_lab.py','utf8');
 assert.match(v4,/replay\.run\(\)/);
 assert.match(v4,/candidate_receipt\(report\)/);
 const v4api26=readFileSync('tooling/android/guardiao_candidate_release_v4_api26_single_pdf_lab.py','utf8');
 assert.match(v4api26,/report = contract\.load_json\(raw\)/);
 assert.match(v4api26,/receipt_valid\(report\)/);
 assert.doesNotMatch(runner,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|print\(report\)|print\(raw\)|print\(uri\)|print\(nodes\)/);
});

test('compile source enforces owned cache UUID before available/sharing, and wrapper refuses wrong CLI args',()=>{
 assert.match(app,/isOwnedPdfUri:uri=>isOwnedPrintPdfUri\(uri,FileSystem\.cacheDirectory\)/);
 assert.match(flow,/ports\.isOwnedPdfUri&&ports\.isOwnedPdfUri\(createdUri\)!==true/);
 assert.match(flow,/phase='invalid-uri'/);
 assert.match(app,/print:async content=>\{/);
 const x=spawnSync('python3',['tooling/android/guardiao_owned_uri_v5_cross_api_pdf_lab.py','unexpected-argument'],{encoding:'utf8',timeout:12000});
 assert.equal(x.status,1,x.stderr);
 assert.match(x.stderr,/BLOCK \(LAB\): v5 owned-uri PDF Android receiver unverified/);
 assert.doesNotMatch(x.stdout+x.stderr,/0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4/);
});
