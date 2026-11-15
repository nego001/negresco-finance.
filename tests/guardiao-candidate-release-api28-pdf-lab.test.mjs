import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const py=readFileSync('tooling/android/guardiao_candidate_release_api28_pdf_lab.py','utf8');
const wf=readFileSync('.github/workflows/guardiao-candidate-release-api28-pdf-lab.yml','utf8');

test('candidate lab pins different Release-mode test APK and cannot release original APK',()=>{
 assert.match(py,/PINNED_CANDIDATE = "544bd201327606711a573bf99729894ee44338fc6e14e5d872c67a4662bbdc59"/);
 assert.match(py,/ORIGINAL_IMMUTABLE = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(py,/contract\.REQUIRED/);
 assert.match(py,/semantic\.ensure_absent\(\)/);
 assert.match(wf,/run-id: 43741679134/);
 assert.match(wf,/sample: \[a, b, c\]/);
 assert.match(wf,/api-level: 28/);
 assert.match(wf,/sha256sum --check --strict/);
 assert.match(wf,/actions: read/);
 assert.match(wf,/persist-credentials: false/);
 assert.doesNotMatch(wf,/assembleRelease|assembleDebug|upload-artifact|workflow_dispatch|secrets\.|eas update|contents: write|publish-test-prerelease/i);
});

test('synthetic candidate receipt refuses original APK, altered API or missing receiver semantics',()=>{
 const code=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_candidate_release_api28_pdf_lab as x',
  'import verify_collection48_receipt as c',
  'r={k:True for k in c.TRUE_FLAGS}',
  'r.update({k:False for k in c.FALSE_FLAGS})',
  'r.update(api=28,apkSha256=x.PINNED_CANDIDATE,schemaVersion=2,scope=c.SCOPE,sourceFixture=x.FIXTURE,pdfPageCount=1,pdfPages=1,nonblankPages=1,textPagesVerified=1,pdfSizeBytes=410,receivedPdfSha256="c"*64)',
  'assert x.candidate_receipt(r)',
  'for key,value in (("api",26),("api",True),("apkSha256",x.ORIGINAL_IMMUTABLE),("approvedForProduction",True),("receiverCacheClean",False),("receivedPdfSha256","z"*64),("scope","WRONG"),("pdfPageCount",0),("textPagesVerified",2)):',
  ' candidate=dict(r);candidate[key]=value',
  ' assert not x.candidate_receipt(candidate),(key,value)',
  'candidate=dict(r);candidate["extra"]="unsafe";assert not x.candidate_receipt(candidate)',
  'assert not x.candidate_receipt(None)',
  'print("PASS: candidate receipt distinguishes immutable original and validates strict semantic gates")'
 ].join('\n');
 const result=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: candidate receipt distinguishes immutable original/);
});
