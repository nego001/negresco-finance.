import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const tool=resolve('tooling/android/verify_node_forge_dependency_paths.cjs');
const {make,resolve:resolveNpm,capture,verify}=require(tool);
const {sbom}=require('../tooling/android/npm_lock_cyclonedx_sbom.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const integrity='sha512-'+Buffer.alloc(64,5).toString('base64');
const packages={
  'node_modules/expo':{name:'expo',version:'54.0.38',
    dependencies:{'@expo/cli':'54.0.28'}},
  'node_modules/expo-updates':{name:'expo-updates',version:'29.0.20',
    dependencies:{'@expo/code-signing-certificates':'^0.0.6'}},
  'node_modules/expo/node_modules/@expo/cli':{name:'@expo/cli',version:'54.0.28',
    dependencies:{'@expo/code-signing-certificates':'^0.0.6','node-forge':'^1.3.3'}},
  'node_modules/@expo/code-signing-certificates':{name:'@expo/code-signing-certificates',
    version:'0.0.6',dependencies:{'node-forge':'^1.3.3'}},
  'node_modules/node-forge':{name:'node-forge',version:'1.4.0'}
};
function lock(){
 const pkg={'':{name:'@negresco/mobile',version:'3.1.3',
   dependencies:{expo:'~54.0.0','expo-updates':'~29.0.0'}}};
 for(const [key,data] of Object.entries(packages)){
  const name=key.split('node_modules/').at(-1);
  pkg[key]={version:data.version,
   resolved:'https://registry.npmjs.org/'+name+'/-/'+name.split('/').at(-1)+'-'+data.version+'.tgz',
   integrity,...(data.dependencies?{dependencies:{...data.dependencies}}:{})};
 }
 return {name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages:pkg};
}
function fixture(t,edit){
 const dir=mkdtempSync(join(tmpdir(),'negresco-forge-paths-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const lockfile=join(dir,'package-lock.json'),sbomFile=join(dir,'bom.json'),
  ledgerFile=join(dir,'ledger.json'),output=join(dir,'nodeforge-paths.json');
 const pkg=lock();edit?.(pkg);
 const lockBytes=Buffer.from(JSON.stringify(pkg));
 const bomBytes=Buffer.from(JSON.stringify(sbom(lockBytes),null,2)+'\n');
 const ledger={
  productionApproved:false,counts:{high:5,total:5},
  hashes:{lockSha256:sha(lockBytes),sbomSha256:sha(bomBytes)},
  vulnerabilities:['@expo/cli','@expo/code-signing-certificates','expo','expo-updates','node-forge']
    .map(name=>({name,lockedVersions:name==='node-forge'?
      [{location:'node_modules/node-forge',version:'1.4.0'}]:[]}))
 };
 writeFileSync(lockfile,lockBytes);writeFileSync(sbomFile,bomBytes);
 writeFileSync(ledgerFile,JSON.stringify(ledger));
 return {dir,lockfile,sbomFile,ledgerFile,output,lockBytes,bomBytes,
  ledgerBytes:Buffer.from(JSON.stringify(ledger))};
}
const params=f=>[f.lockfile,f.sbomFile,f.ledgerFile,f.output];
function deny(f,regex){
 assert.throws(()=>capture(...params(f)),regex);
 const out=spawnSync('node',[tool,'capture',...params(f)],{encoding:'utf8',timeout:10000});
 assert.equal(out.status,1,out.stdout+out.stderr);
 assert.match(out.stderr,regex);
}
test('three actual npm package-resolution routes reach the unpatched node-forge',t=>{
 const f=fixture(t);capture(...params(f));verify(...params(f));
 const j=JSON.parse(readFileSync(f.output,'utf8'));
 assert.equal(j.paths.length,3);
 assert.deepEqual(j.paths.map(p=>p.edges.map(e=>e.dependency).join('>')).sort(),[
  'expo>@expo/cli>@expo/code-signing-certificates>node-forge',
  'expo>@expo/cli>node-forge',
  'expo-updates>@expo/code-signing-certificates>node-forge'
 ].sort());
 assert.equal(j.target.version,'1.4.0');
 assert.equal(j.productionApproved,false);
 assert.match(j.scope,/NOT Android runtime execution reachability/);
 assert.equal(j.sha256.lock,sha(f.lockBytes));
});
test('npm nearest node_modules resolution respects nested @expo/cli',t=>{
 const f=fixture(t);
 const parsed=JSON.parse(f.lockBytes);
 assert.equal(resolveNpm(parsed,'node_modules/expo','@expo/cli'),
   'node_modules/expo/node_modules/@expo/cli');
 assert.equal(resolveNpm(parsed,'node_modules/expo/node_modules/@expo/cli','node-forge'),
   'node_modules/node-forge');
 assert.equal(resolveNpm(parsed,'node_modules/expo/node_modules/@expo/cli','@expo/code-signing-certificates'),
   'node_modules/@expo/code-signing-certificates');
});
test('source-matched candidate report is deterministic and verifiable with CLI',t=>{
 const f=fixture(t);
 let r=spawnSync('node',[tool,'capture',...params(f)],{encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr);
 const first=readFileSync(f.output);rmSync(f.output);
 capture(...params(f));assert.deepEqual(readFileSync(f.output),first);
 r=spawnSync('node',[tool,'verify',...params(f)],{encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr);
});
test('unexpected extra graph route or silently removed Expo parent is blocked',t=>{
 deny(fixture(t,p=>{p.packages[''].dependencies['node-forge']='^1.3.3';}),/dependency routes changed/);
 deny(fixture(t,p=>{delete p.packages[''].dependencies['expo-updates'];}),/missing expected root Expo direct/);
 deny(fixture(t,p=>{delete p.packages['node_modules/expo'].dependencies['@expo/cli'];}),/node-forge dependency routes changed/);
});
test('direct native-package replacement or fake safe forge version is rejected',t=>{
 deny(fixture(t,p=>{p.packages['node_modules/node-forge'].version='1.4.1';}),/root advisory version\/path mismatch/);
 deny(fixture(t,p=>{delete p.packages['node_modules/node-forge'];}),/root advisory version\/path mismatch/);
});
test('Downloaded evidence fails after tampering report, SBOM, or npm lock',t=>{
 for(const file of ['output','sbomFile','ledgerFile','lockfile']){
  const f=fixture(t);capture(...params(f));
  writeFileSync(f[file],Buffer.concat([readFileSync(f[file]),Buffer.from(' ')]));
  assert.throws(()=>verify(...params(f)),/downloaded node-forge|SBOM differs|advisory ledger differs/);
 }
});
test('tampered ledger approval or omitted vulnerabilities cannot pass',t=>{
 const f=fixture(t);
 const ledger=JSON.parse(readFileSync(f.ledgerFile,'utf8'));
 ledger.productionApproved=true;writeFileSync(f.ledgerFile,JSON.stringify(ledger));
 deny(f,/advisory ledger differs/);
 const f2=fixture(t);const ledger2=JSON.parse(readFileSync(f2.ledgerFile,'utf8'));
 ledger2.vulnerabilities.pop();writeFileSync(f2.ledgerFile,JSON.stringify(ledger2));
 deny(f2,/expected five unsuppressed/);
});
test('links are refused before loading untrusted downloaded SBOM data',t=>{
 const f=fixture(t),link=join(f.dir,'linked-bom.json');
 symlinkSync(f.sbomFile,link);
 assert.throws(()=>capture(f.lockfile,link,f.ledgerFile,f.output),/missing, linked or oversized/);
});
test('report cannot claim release approval or hide advisory graph while preserving hash',t=>{
 const f=fixture(t);capture(...params(f));
 const report=JSON.parse(readFileSync(f.output,'utf8'));
 report.productionApproved=true;report.paths=[];
 writeFileSync(f.output,JSON.stringify(report));
 assert.throws(()=>verify(...params(f)),/downloaded node-forge dependency paths differ/);
});
test('independent downloaded APK workflow verifies routes before inspecting compiled OTA',()=>{
 const wf=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 assert.match(wf,/lab\/p01-verified-node-forge-dependency-paths-v1/);
 const b=wf.slice(wf.indexOf('  assemble-combined-lab-apk:'),wf.indexOf('  reverify-downloaded-combined-apk:'));
 const v=wf.slice(wf.indexOf('  reverify-downloaded-combined-apk:'));
 assert.match(b,/verify_node_forge_dependency_paths\.cjs capture/);
 assert.match(b,/apps\/mobile\/NODE_FORGE_DEPENDENCY_PATHS\.json/);
 assert.match(v,/verify_node_forge_dependency_paths\.cjs verify/);
 assert.match(v,/combined-apk\/NODE_FORGE_DEPENDENCY_PATHS\.json/);
 assert.ok(v.indexOf('npm_audit_sbom_ledger.cjs verify')<
   v.indexOf('verify_node_forge_dependency_paths.cjs verify'));
 assert.ok(v.indexOf('verify_node_forge_dependency_paths.cjs verify')<
   v.indexOf('verify_compiled_ota_runtime.py'));
 assert.match(v,/permissions:\s*\n\s+contents: read/);
 assert.doesNotMatch(v,/npm ci|npm install|contents: write|secrets\.|gh release/);
});
