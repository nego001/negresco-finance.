import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {compare}=require('../tooling/android/compare_image_size_major.cjs');
const workflow=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
function fakeEntry(version){
  return {version,integrity:'sha512-'+Buffer.alloc(64,7).toString('base64'),
    resolved:'https://registry.npmjs.org/fixture/-/fixture-'+version+'.tgz'};
}
function lock(patched=false){
  const packages={'':{name:'@negresco/mobile',version:'3.1.3'}};
  for(const [name,v] of Object.entries({
    expo:'54.0.38','expo-updates':'29.0.20',react:'19.1.0',
    'react-native':'0.81.4',postcss:'8.5.23','node-forge':'1.4.0',
    'image-size':patched?'2.0.3':'1.2.1'
  }))packages['node_modules/'+name]=fakeEntry(v);
  return {name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages};
}
function audit(high=6,moderate=0){
  const vulnerabilities={};for(let i=0;i<high;i++)vulnerabilities['high-'+i]={severity:'high'};
  for(let i=0;i<moderate;i++)vulnerabilities['moderate-'+i]={severity:'moderate'};
  return {auditReportVersion:2,vulnerabilities,metadata:{vulnerabilities:{
    info:0,low:0,moderate,high,critical:0,total:high+moderate
  }}};
}
test('isolated major patch may decrease advisories without changing Expo or PostCSS',()=>{
  const v=compare(lock(),lock(true),audit(6),audit(5));
  assert.equal(v.reviewed,false);
  assert.equal(v.patchedImageSize,'2.0.3');
  assert.deepEqual(v.changedPackages,[{path:'node_modules/image-size',from:'1.2.1',to:'2.0.3'}]);
  assert.equal(v.baselineAdvisories.total,6);
  assert.equal(v.candidateAdvisories.total,5);
});
test('refuse unpatched image-size versions even if advisory numbers improve',()=>{
  const c=lock(true);c.packages['node_modules/image-size'].version='2.0.2';
  assert.throws(()=>compare(lock(),c,audit(6),audit(5)),/not a real pinned upgrade/);
});
test('refuse any Expo/React/PostCSS/node-forge drift in isolated image-size experiment',()=>{
  for(const name of ['expo','expo-updates','react','react-native','postcss','node-forge']){
    const c=lock(true);c.packages['node_modules/'+name].version='0.0.1';
    assert.throws(()=>compare(lock(),c,audit(6),audit(5)),/unexpected Expo\/core\/postcss\/node-forge/);
  }
});
test('refuse extra package replacements beyond image-size itself',()=>{
  const c=lock(true);c.packages['node_modules/other']=fakeEntry('2.0.3');
  assert.throws(()=>compare(lock(),c,audit(6),audit(5)),/unexpected transitive dependency change/);
});
test('refuse lack of improvement and increases in critical or high advisories',()=>{
  assert.throws(()=>compare(lock(),lock(true),audit(6),audit(6)),/did not reduce advisory totals/);
  assert.throws(()=>compare(lock(),lock(true),audit(6),audit(7)),/did not reduce advisory totals/);
  assert.throws(()=>compare(lock(),lock(true),audit(5,1),audit(6)),/did not reduce advisory totals/);
});
test('refuse incorrect npm advisory JSON or inconsistent totals',()=>{
  const malformed=audit(5);malformed.metadata.vulnerabilities.total=90;
  assert.throws(()=>compare(lock(),lock(true),audit(6),malformed),/advisory counts disagree/);
  assert.throws(()=>compare(lock(),lock(true),audit(6),{error:'network'}),/invalid npm advisory report/);
});
test('laboratory workflow has no production triggers, code signing or release access',()=>{
  assert.match(workflow,/branches:\s*\n\s+- lab\/p01-image-size-major-feasibility-v1/);
  assert.match(workflow,/permissions:\s*\n\s+contents: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/workflow_dispatch:|pull_request:|contents: write|secrets\.|gh release|git push|git tag|assembleRelease/);
  assert.match(workflow,/UNREVIEWED IMAGE-SIZE MAJOR EXPERIMENT/);
  assert.match(workflow,/retention-days: 7/);
});
test('candidate uses exact temporary overrides and sha-verified npm ci',()=>{
  assert.match(workflow,/p\.overrides=\{postcss:'8\.5\.23'\}/);
  assert.match(workflow,/p\.overrides\['image-size'\]='2\.0\.3'/);
  assert.match(workflow,/p\.overrides=\{postcss:'8\.5\.23','image-size':'2\.0\.3'\}/);
  assert.match(workflow,/--package-lock-only --ignore-scripts/);
  assert.match(workflow,/report\.sourceDigests\.candidateLock!==sha\(lock\)/);
  assert.match(workflow,/run: npm ci --no-audit --no-fund/);
  assert.match(workflow,/npx tsc --noEmit/);
  assert.match(workflow,/expo prebuild --platform android --non-interactive --no-install/);
  assert.match(workflow,/verify_generated_ota_runtime\.py/);
});
