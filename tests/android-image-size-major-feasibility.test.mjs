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
test('allow removing queue only when old image-size was its sole dependent',()=>{
  const base=lock(),candidate=lock(true);
  base.packages['node_modules/image-size'].dependencies={queue:'6.0.2'};
  base.packages['node_modules/queue']=fakeEntry('6.0.2');
  const report=compare(base,candidate,audit(6),audit(5));
  assert.deepEqual(report.changedPackages,[
    {path:'node_modules/image-size',from:'1.2.1',to:'2.0.3'},
    {path:'node_modules/queue',from:'6.0.2',to:null}
  ]);
});
test('refuse deleting queue when some other package also requires it',()=>{
  const base=lock(),candidate=lock(true);
  base.packages['node_modules/image-size'].dependencies={queue:'6.0.2'};
  base.packages['node_modules/expo'].dependencies={queue:'6.0.2'};
  candidate.packages['node_modules/expo'].dependencies={queue:'6.0.2'};
  base.packages['node_modules/queue']=fakeEntry('6.0.2');
  assert.throws(()=>compare(base,candidate,audit(6),audit(5)),/unexpected transitive dependency change/);
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
  assert.doesNotMatch(workflow,/workflow_dispatch:|pull_request:|contents: write|secrets\.|gh release|git push|git tag/);
  const preBuildLab=workflow.slice(0,workflow.indexOf('  assemble-combined-lab-apk:'));
  assert.doesNotMatch(preBuildLab,/assembleRelease/);
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

test('combined-patch APK workflow is isolated to laboratory branches and cannot publish',()=>{
  assert.match(workflow,/branches:\s*\n\s+- lab\/p01-image-size-major-feasibility-v1\s*\n\s+- lab\/p01-postcss-image-size-combined-apk-v1/);
  assert.match(workflow,/  assemble-combined-lab-apk:/);
  assert.match(workflow,/needs: smoke/);
  assert.match(workflow,/  reverify-downloaded-combined-apk:/);
  assert.match(workflow,/needs: assemble-combined-lab-apk/);
  assert.doesNotMatch(workflow,/workflow_dispatch:|contents: write|secrets\.|gh release|git push|git tag/);
});
test('combined-patch APK uses exact graph changes and checksum before npm ci',()=>{
  const start=workflow.indexOf('  assemble-combined-lab-apk:');
  const end=workflow.indexOf('  reverify-downloaded-combined-apk:');
  assert.ok(start>0&&end>start);
  const job=workflow.slice(start,end);
  assert.match(job,/permissions:\s*\n\s+contents: read/);
  assert.match(job,/persist-credentials: false/);
  assert.match(job,/postcss:'8\.5\.23','image-size':'2\.0\.3'/);
  assert.match(job,/data\.sourceDigests\.candidateLock!==hash\(lock\)/);
  assert.match(job,/changedPackages\.length!==2/);
  assert.match(job,/node_modules\/queue/);
  assert.match(job,/npm ci --no-audit --no-fund/);
  assert.match(job,/npx tsc --noEmit/);
  assert.match(job,/expo prebuild --platform android --non-interactive --no-install/);
  assert.match(job,/test ! -e android\/app\/negresco-ci-release\.jks/);
  assert.match(job,/\.\/gradlew assembleRelease --no-daemon/);
  assert.match(job,/verify_compiled_ota_runtime\.py/);
  assert.match(job,/verify_compiled_preview_ota\.py/);
  assert.match(job,/verify_packaged_expo_config\.py/);
  assert.match(job,/combined-patch-debug-apk-unreviewed/);
  assert.match(job,/retention-days: 3/);
});
test('independent downloaded combined-patch APK check validates SHA and native binary',()=>{
  const i=workflow.indexOf('  reverify-downloaded-combined-apk:');
  assert.ok(i>0);
  const verify=workflow.slice(i);
  assert.match(verify,/permissions:\s*\n\s+contents: read/);
  assert.match(verify,/persist-credentials: false/);
  assert.match(verify,/actions\/download-artifact@v4/);
  assert.match(verify,/name: combined-patch-debug-apk-unreviewed/);
  assert.match(verify,/re\.fullmatch\(pattern,checksum\.read_bytes\(\)\)/);
  assert.match(verify,/hashlib\.sha256\(apk\.read_bytes\(\)\)/);
  assert.match(verify,/apksigner" verify --verbose/);
  assert.match(verify,/verify_release_apk_surface\.py/);
  assert.match(verify,/verify_compiled_ota_runtime\.py/);
  assert.match(verify,/verify_compiled_preview_ota\.py/);
  assert.match(verify,/verify_packaged_expo_config\.py/);
  assert.doesNotMatch(verify,/npm install|npm ci|gradlew|contents: write|secrets\.|gh release/);
});
