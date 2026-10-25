import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {assess}=require('../tooling/android/assess_postcss_patch_candidate.cjs');
const workflow=readFileSync(resolve('.github/workflows/postcss-advisory-lab.yml'),'utf8');

const version=(v)=>({version:v,resolved:'https://registry.npmjs.org/fixture/-/fixture-'+v+'.tgz',integrity:'sha512-'+Buffer.alloc(64,0).toString('base64')});
const basePackages={
  '':{name:'@negresco/mobile',version:'3.1.3'},
  'node_modules/expo':version('54.0.38'),
  'node_modules/expo-updates':version('29.0.20'),
  'node_modules/react':version('19.1.0'),
  'node_modules/react-native':version('0.81.4'),
  'node_modules/postcss':version('8.4.49'),
  'node_modules/image-size':version('1.2.1'),
  'node_modules/node-forge':version('1.4.0')
};
const lock=(patch=false)=>{
  const x={lockfileVersion:3,name:'@negresco/mobile',version:'3.1.3',packages:structuredClone(basePackages)};
  if(patch)x.packages['node_modules/postcss']=version('8.5.23');
  return x;
};
function audit(levels=[]){
  const counts={info:0,low:0,moderate:0,high:0,critical:0,total:levels.length},vulnerabilities={};
  for(const [i,level] of levels.entries()){
    counts[level]++;
    vulnerabilities['vulnerability-'+i]={severity:level,isDirect:false,via:[{name:'fixture'}]};
  }
  return {auditReportVersion:2,metadata:{vulnerabilities:counts},vulnerabilities};
}
const vulnerable=['high','high','high','high','high','high','high','moderate'];
test('patched PostCSS comparison accepts reduced advisories without promoting release',()=>{
  const result=assess(lock(),lock(true),audit(vulnerable),audit(vulnerable.slice(0,7)));
  assert.equal(result.label,'UNREVIEWED EXPERIMENT - NEVER PUBLISH');
  assert.equal(result.reviewed,false);
  assert.equal(result.beforePostcss[0].version,'8.4.49');
  assert.equal(result.afterPostcss[0].version,'8.5.23');
  assert.equal(result.baselineAdvisories.total,8);
  assert.equal(result.candidateAdvisories.total,7);
  assert.equal(result.expoUnchanged,true);
  assert.equal(result.otherChangedPackages,1);
});
test('PostCSS experiment blocks unpatched or unrelated PostCSS versions',()=>{
  for(const v of ['8.4.49','8.5.22','8.5.31']){
    const next=lock(true);next.packages['node_modules/postcss'].version=v;
    assert.throws(()=>assess(lock(),next,audit(vulnerable),audit(vulnerable)),/PostCSS version is not pinned/);
  }
});
test('PostCSS patch cannot downgrade Expo, React or OTA direct dependencies',()=>{
  for(const pkg of ['expo','expo-updates','react','react-native']){
    const next=lock(true);next.packages['node_modules/'+pkg].version='0.0.1';
    assert.throws(()=>assess(lock(),next,audit(),audit()),/core Expo\/React package drift/);
  }
});
test('PostCSS comparison rejects an increase in high, critical or total advisories',()=>{
  assert.throws(()=>assess(lock(),lock(true),audit([]),audit(['high'])),/increased npm advisory risk/);
  assert.throws(()=>assess(lock(),lock(true),audit(['high']),audit(['critical'])),/increased npm advisory risk/);
});
test('reject malformed npm audit response and non-matching severity totals',()=>{
  const damaged=audit(['high']);
  damaged.metadata.vulnerabilities.total=42;
  assert.throws(()=>assess(lock(),lock(true),audit(),damaged),/inconsistent advisory totals/);
  assert.throws(()=>assess(lock(),lock(true),audit(),{error:'unavailable'}),/invalid npm advisory response/);
});
test('reject excessive unrelated lock graph drift',()=>{
  const altered=lock(true);
  for(let i=0;i<160;i++)altered.packages['node_modules/extra-'+i]=version('1.0.0');
  assert.throws(()=>assess(lock(),altered,audit(),audit()),/too much npm lock graph drift/);
});
test('isolated experiment has no permission to publish or modify the repository',()=>{
  assert.match(workflow,/branches:\s*\n\s+- lab\/p01-postcss-patch-feasibility-v1/);
  assert.match(workflow,/permissions:\s*\n\s+contents: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/workflow_dispatch:|pull_request:|contents: write|secrets\.|gh release|git push|git tag/);
  assert.match(workflow,/retention-days: 7/);
});
test('optional candidate smoke job installs only the tested lock in a read-only runner',()=>{
  const n=workflow.indexOf('  smoke-patched-expo:');
  assert.ok(n>0);
  const job=workflow.slice(n);
  assert.match(job,/needs: compare-review-only/);
  assert.match(job,/permissions:\s*\n\s+contents: read/);
  assert.match(job,/persist-credentials: false/);
  assert.match(job,/actions\/download-artifact@v4/);
  assert.match(job,/postcss-lab-unreviewed-comparison/);
  assert.match(job,/candidateLockSha256/);
  assert.match(job,/npm ci --no-audit --no-fund/);
  assert.match(job,/npx tsc --noEmit/);
  assert.match(job,/expo prebuild --platform android --non-interactive --no-install/);
  assert.match(job,/app\.updates\?\.requestHeaders\?\.\['expo-channel-name'\]/);
  assert.doesNotMatch(job,/contents: write|secrets\.|gh release|git push|gradlew|assembleRelease|apk-signer/);
});
test('experiment generates baseline and override candidate without installation scripts',()=>{
  assert.match(workflow,/npm install --package-lock-only --ignore-scripts --no-audit --no-fund/);
  assert.match(workflow,/p\.overrides=\{postcss:'8\.5\.23'\}/);
  assert.match(workflow,/npm audit --json --package-lock-only/);
  assert.match(workflow,/assess_postcss_patch_candidate\.cjs/);
  assert.match(workflow,/postcss-lab-unreviewed-comparison/);
  assert.doesNotMatch(workflow,/npm audit fix|npm ci|expo prebuild|assembleRelease/);
});
