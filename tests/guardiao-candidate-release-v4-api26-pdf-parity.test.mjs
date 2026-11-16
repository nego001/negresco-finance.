import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const wf=readFileSync('.github/workflows/guardiao-candidate-release-v4-api26-pdf-parity.yml','utf8');
const py=readFileSync('tooling/android/guardiao_candidate_release_v4_api26_single_pdf_lab.py','utf8');

test('API26 comparator reuses same SHA pinned v4 APK, receiver and lifecycle without production actions',()=>{
 assert.match(wf,/run-id: 43772274643/);
 assert.match(wf,/3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6/g);
 assert.match(wf,/CN=Android Debug/);
 assert.match(wf,/api-level: 26/);
 assert.match(wf,/scenario: \[single_pdf\]/);
 assert.match(wf,/build_receiving_apk\.sh/);
 assert.match(wf,/pdftotext/);
 assert.match(wf,/sha256sum --check --strict/g);
 assert.match(wf,/persist-credentials: false/);
 assert.match(wf,/contents: read/);
 assert.doesNotMatch(wf,/contents: write|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch|secrets\.|continue-on-error: true|eas update/);
 assert.match(py,/candidate\.candidate_identity\(candidate\.APK\)/);
 assert.match(py,/replay\.run\(\)/);
 assert.match(py,/semantic\.ensure_absent\(\)/);
 assert.match(py,/EXPECTED_API = 26/);
 assert.match(py,/candidate\.PINNED_CANDIDATE == candidate\.ORIGINAL_IMMUTABLE/);
 assert.match(py,/report\["api"\] != EXPECTED_API/);
 const executable=py.replace(/"""[\s\S]*?"""/g,'').replace(/^\s*#.*$/gm,'');
 assert.doesNotMatch(executable,/input", "tap"|force-stop|pm", "clear"|print\(report\)|print\(raw\)|print\(uri\)|print\(nodes\)/);
});
test('API26 receipt accepts exact candidate semantic evidence and rejects spoofed/partial reports',()=>{
 const code=[
 "import sys",
 "sys.path.insert(0,'tooling/android')",
 "import guardiao_candidate_release_v4_api26_single_pdf_lab as t",
 "import verify_collection48_receipt as c",
 "d={k: True for k in c.TRUE_FLAGS}",
 "d.update({k:False for k in c.FALSE_FLAGS})",
 "d.update({'api':26,'apkSha256':t.candidate.PINNED_CANDIDATE,'sourceFixture':t.candidate.FIXTURE,'scope':c.SCOPE,'schemaVersion':2,'pdfPageCount':1,'pdfSizeBytes':2048,'pdfPages':1,'nonblankPages':1,'textPagesVerified':1,'receivedPdfSha256':'a'*64})",
 "assert set(d)==c.REQUIRED",
 "assert t.receipt_valid(d)",
 "for name,value in [('api',28),('api',True),('apkSha256',t.candidate.ORIGINAL_IMMUTABLE),('sourceFixture','unknown'),('scope','wrong'),('pdfPageCount',0),('pdfSizeBytes',200),('nonblankPages',0),('systemChooserObserved',False),('approvedForProduction',True),('receivedPdfSha256','bad')]:",
 " bad=dict(d);bad[name]=value",
 " assert not t.receipt_valid(bad),(name,value)",
 "bad=dict(d);del bad['privateCaptureDeleted'];assert not t.receipt_valid(bad)",
 "bad=dict(d);bad['extra']=True;assert not t.receipt_valid(bad)",
 "assert not t.receipt_valid(None)",
 "print('PASS: API26 independent strict semantic receipt synthetic matrix')"
 ].join('\n');
 const result=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: API26 independent strict semantic receipt synthetic matrix/);
});
