import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const source=readFileSync('tooling/android/guardiao_original_apk_provenance_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-original-apk-provenance-lab.yml','utf8');

test('original APK source preflight is read-only, without APK download or rebuild',()=>{
 assert.match(source,/RUN_ID = 40617164086/);
 assert.match(source,/SOURCE_COMMIT = "a01286f91c53a12e977c3e550300c872e5955d45"/);
 assert.match(source,/ARTIFACT_NAME = "negresco-finance-v313-security-preview"/);
 assert.match(source,/MAX_RESPONSE_BYTES = 1_048_576/);
 assert.match(workflow,/lab\/p01-guardiao-original-apk-provenance-v1/);
 assert.match(workflow,/actions: read/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
 assert.doesNotMatch(workflow,/workflow_dispatch|assembleRelease|assembleDebug|emulator-runner|download-artifact|upload-artifact|eas update|contents: write|secrets\./i);
 assert.doesNotMatch(source,/subprocess|print\(raw\)|print\(run\)|print\(listing\)|archive_download_url|artifact\.zip|open\(.+wb/i);
});

test('original source classifier blocks absent, expired, ambiguous and forged artifact metadata',()=>{
 const code=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_original_apk_provenance_lab as x',
  'run={"id":x.RUN_ID,"head_sha":x.SOURCE_COMMIT,"status":"completed","conclusion":"success"}',
  'art={"id":12,"name":x.ARTIFACT_NAME,"expired":False,"size_in_bytes":35_000_000,"workflow_run":{"id":x.RUN_ID}}',
  'def check(items): return x.classify_metadata(run,{"total_count":len(items),"artifacts":items})',
  'assert check([])=="original-artifact-not-listed"',
  'assert check([art,art])=="original-artifact-ambiguous"',
  'assert check([dict(art,expired=True)])=="original-artifact-expired-or-unconfirmed"',
  'assert check([dict(art,size_in_bytes=0)])=="original-artifact-size-unconfirmed"',
  'assert check([dict(art,workflow_run={"id":1})])=="original-artifact-link-unconfirmed"',
  'assert x.classify_metadata(dict(run,head_sha="0"*40),{"total_count":1,"artifacts":[art]})=="source-run-provenance-unconfirmed"',
  'assert x.classify_metadata(run,{"total_count":2,"artifacts":[art]})=="artifact-list-unconfirmed"',
  'assert check([art])=="original-artifact-metadata-ready-for-sha-verification"',
  'print("PASS: provenance metadata classifier; bytes still require SHA")'
 ].join('\n');
 const process=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:15000});
 assert.equal(process.status,0,process.stderr);
 assert.match(process.stdout,/PASS: provenance metadata classifier/);
});
