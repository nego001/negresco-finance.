import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const auditorPath=resolve('tooling/android/verify_combined_apk_provenance.cjs');
const {capture,verify,validateInputs}=require(auditorPath);
const commit='a'.repeat(40);
const sha=x=>createHash('sha256').update(x).digest('hex');
const canonicalChanges=[
 {path:'node_modules/image-size',from:'1.2.1',to:'2.0.3'},
 {path:'node_modules/queue',from:'6.0.2',to:null}
];
function fixture(t,edit){
  const root=mkdtempSync(join(tmpdir(),'negresco-apk-lock-provenance-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const apk=join(root,'artifact.apk'),lockFile=join(root,'package-lock.json');
  const reportFile=join(root,'feasibility.json'),provenance=join(root,'provenance.json');
  writeFileSync(apk,Buffer.from('synthetic APK bytes for digest contract only'));
  const graph={name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages:{
    '':{name:'@negresco/mobile',version:'3.1.3'},
    'node_modules/postcss':{version:'8.5.23'},
    'node_modules/image-size':{version:'2.0.3'}
  }};
  writeFileSync(lockFile,JSON.stringify(graph));
  const report={
    label:'UNREVIEWED IMAGE-SIZE MAJOR EXPERIMENT - DO NOT PUBLISH',
    reviewed:false,expoUnchanged:true,patchedImageSize:'2.0.3',
    changedPackages:structuredClone(canonicalChanges),
    baselineAdvisories:{high:6,total:6},
    candidateAdvisories:{high:5,total:5},
    sourceDigests:{candidateLock:sha(readFileSync(lockFile))}
  };
  edit?.({graph,report,apk,lockFile});
  writeFileSync(lockFile,JSON.stringify(graph));
  if(!edit||!edit.__keepDigest)report.sourceDigests.candidateLock=sha(readFileSync(lockFile));
  writeFileSync(reportFile,JSON.stringify(report));
  return {root,apk,lockFile,reportFile,provenance};
}
function args(f){return [f.apk,f.lockFile,f.reportFile,f.provenance,commit];}
function shouldBlock(f,re){
  assert.throws(()=>capture(...args(f)),re);
  const r=spawnSync('node',[auditorPath,'capture',...args(f)],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,1,r.stderr+r.stdout);
  assert.match(r.stderr,re);
}
test('bind clean APK, candidate lock and exact source commit, then verify same bytes',t=>{
  const f=fixture(t);
  capture(...args(f));
  verify(...args(f));
  const evidence=JSON.parse(readFileSync(f.provenance,'utf8'));
  assert.equal(evidence.sourceCommit,commit);
  assert.equal(evidence.apk.sha256,sha(readFileSync(f.apk)));
  assert.equal(evidence.dependencies.lockSha256,sha(readFileSync(f.lockFile)));
  assert.equal(evidence.dependencies.highAdvisories,5);
  assert.equal(evidence.reviewerApproved,false);
  assert.match(evidence.status,/NOT A PRODUCTION RELEASE/);
});
test('CLI capture and verify prove matching hashes',t=>{
  const f=fixture(t);
  let r=spawnSync('node',[auditorPath,'capture',...args(f)],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr);
  r=spawnSync('node',[auditorPath,'verify',...args(f)],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/downloaded APK cryptographically matches/);
});
test('modified APK bytes after producer evidence are rejected',t=>{
  const f=fixture(t);capture(...args(f));writeFileSync(f.apk,'tampered apk');
  assert.throws(()=>verify(...args(f)),/relationship differs from producer/);
});
test('tampered lock after producer evidence rejects hash binding or policy drift',t=>{
  const f=fixture(t);capture(...args(f));
  const graph=JSON.parse(readFileSync(f.lockFile,'utf8'));
  graph.packages['node_modules/image-size'].version='2.0.2';
  writeFileSync(f.lockFile,JSON.stringify(graph));
  assert.throws(()=>verify(...args(f)),/expected PostCSS\/image-size combination/);
});
test('postcss versions, old queue and unexpected package identity are rejected',t=>{
  for(const mutate of [
    ({graph})=>graph.packages['node_modules/postcss'].version='8.4.49',
    ({graph})=>graph.packages['node_modules/image-size'].version='1.2.1',
    ({graph})=>graph.packages['node_modules/queue']={version:'6.0.2'},
    ({graph})=>graph.name='@attacker/mobile'
  ]){const f=fixture(t,mutate);shouldBlock(f,/candidate npm graph/);}
});
test('wrong reviewer status, graph diff or advisory report blocks APK provenance creation',t=>{
  for(const mutate of [
    ({report})=>report.reviewed=true,
    ({report})=>report.changedPackages=[...canonicalChanges,{path:'node_modules/expo',from:'54',to:'55'}],
    ({report})=>report.candidateAdvisories.total=4,
    ({report})=>report.candidateAdvisories.high=0
  ]){const f=fixture(t,mutate);shouldBlock(f,/not bound to reviewed laboratory policy/);}
});
test('malformed source SHA is refused, even with valid graph',t=>{
  const f=fixture(t);
  assert.throws(()=>validateInputs(f.apk,f.lockFile,f.reportFile,'not-a-commit'),/untrusted Git commit SHA/);
});
test('report cannot be promoted by changing source commit or review status',t=>{
  const f=fixture(t);capture(...args(f));
  assert.throws(()=>verify(f.apk,f.lockFile,f.reportFile,f.provenance,'b'.repeat(40)),/relationship differs/);
  const doc=JSON.parse(readFileSync(f.provenance,'utf8'));
  doc.reviewerApproved=true;
  writeFileSync(f.provenance,JSON.stringify(doc));
  assert.throws(()=>verify(...args(f)),/relationship differs/);
});
test('unexpected evidence fields cannot be used to insert approval',t=>{
  const f=fixture(t);capture(...args(f));
  const data=JSON.parse(readFileSync(f.provenance,'utf8'));
  data.productionApproved=true;
  writeFileSync(f.provenance,JSON.stringify(data));
  assert.throws(()=>verify(...args(f)),/relationship differs/);
});
test('malformed or linked package artifacts fail closed',t=>{
  const f=fixture(t);const alias=join(f.root,'alias.json');
  symlinkSync(f.lockFile,alias);
  assert.throws(()=>validateInputs(f.apk,alias,f.reportFile,commit),/missing\/linked\/nonregular/);
  writeFileSync(f.reportFile,'oops');
  assert.throws(()=>validateInputs(f.apk,f.lockFile,f.reportFile,commit),/unparseable JSON/);
});
test('workflow captures provenance after APK hashing and rechecks before reading compiled OTA',()=>{
  const wf=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
  const producer=wf.slice(wf.indexOf('  assemble-combined-lab-apk:'),wf.indexOf('  reverify-downloaded-combined-apk:'));
  const verifier=wf.slice(wf.indexOf('  reverify-downloaded-combined-apk:'));
  assert.match(producer,/verify_combined_apk_provenance\.cjs capture/);
  assert.match(producer,/apps\/mobile\/COMBINED_APK_PROVENANCE\.json/);
  assert.match(producer,/apps\/mobile\/image-size-review\/image-size-candidate-lock\.json/);
  assert.ok(producer.indexOf('sha256sum "$APK"')<producer.indexOf('verify_combined_apk_provenance.cjs capture'));
  assert.match(verifier,/verify_combined_apk_provenance\.cjs verify/);
  assert.match(verifier,/combined-apk\/COMBINED_APK_PROVENANCE\.json "\$GITHUB_SHA"/);
  assert.ok(verifier.indexOf('verify_combined_apk_provenance.cjs verify')<verifier.indexOf('verify_compiled_ota_runtime.py'));
  assert.match(verifier,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(verifier,/contents: write|secrets\.|npm ci|npm install|gradlew|gh release/);
});
