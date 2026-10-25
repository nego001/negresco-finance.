import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const tool=resolve('tooling/android/npm_audit_sbom_ledger.cjs');
const {capture,verify,generate}=require(tool);
const {sbom}=require('../tooling/android/npm_lock_cyclonedx_sbom.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const hash='sha512-'+Buffer.alloc(64,2).toString('base64');
const records=[
 ['node_modules/expo','expo','54.0.38'],
 ['node_modules/expo-updates','expo-updates','29.0.20'],
 ['node_modules/expo/node_modules/@expo/cli','@expo/cli','0.0.1'],
 ['node_modules/@expo/code-signing-certificates','@expo/code-signing-certificates','0.0.1'],
 ['node_modules/node-forge','node-forge','1.4.0'],
 ['node_modules/postcss','postcss','8.5.23'],
 ['node_modules/image-size','image-size','2.0.3']
];
const nodeEntry=(name,via,effects,isDirect=false)=>({
 name,severity:'high',isDirect,via:structuredClone(via),effects:structuredClone(effects),range:'*',
 nodes:[records.find(r=>r[1]===name)[0]],fixAvailable:false
});
const rootAdvisory={
 source:1240912,name:'node-forge',dependency:'node-forge',
 title:'RSA PKCS#1 verification issue',
 url:'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
 severity:'high',range:'<=1.4.0'
};
function dataset(){
 const packages={'':{name:'@negresco/mobile',version:'3.1.3'}};
 for(const [location,name,version] of records){
   const tail=name.split('/').at(-1);
   packages[location]={
     version,integrity:hash,
     resolved:'https://registry.npmjs.org/'+name+'/-/'+tail+'-'+version+'.tgz'
   };
 }
 const lock={name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages};
 const vulnerabilities={
  'expo':nodeEntry('expo',['@expo/cli'],[],true),
  'expo-updates':nodeEntry('expo-updates',['@expo/code-signing-certificates'],[],true),
  '@expo/cli':nodeEntry('@expo/cli',['@expo/code-signing-certificates','node-forge'],['expo']),
  '@expo/code-signing-certificates':nodeEntry('@expo/code-signing-certificates',['node-forge'],['expo-updates']),
  'node-forge':nodeEntry('node-forge',[rootAdvisory],['@expo/cli','@expo/code-signing-certificates'])
 };
 const audit={auditReportVersion:2,vulnerabilities,
  metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:5,critical:0,total:5}}};
 const feasibility={label:'UNREVIEWED IMAGE-SIZE MAJOR EXPERIMENT - DO NOT PUBLISH',
  reviewed:false,candidateAdvisories:{high:5,total:5},
  sourceDigests:{candidateLock:sha(Buffer.from(JSON.stringify(lock)))}};
 return {lock,audit,feasibility};
}
function fixture(t,mutate){
 const folder=mkdtempSync(join(tmpdir(),'negresco-advisory-ledger-'));
 t.after(()=>rmSync(folder,{recursive:true,force:true}));
 const d=dataset();mutate?.(d);
 const lock=join(folder,'lock.json'),audit=join(folder,'audit.json'),
  feasibility=join(folder,'feasibility.json'),bom=join(folder,'sbom.json'),
  ledger=join(folder,'ledger.json');
 const lb=Buffer.from(JSON.stringify(d.lock));
 d.feasibility.sourceDigests.candidateLock=sha(lb);
 writeFileSync(lock,lb);writeFileSync(audit,JSON.stringify(d.audit));
 writeFileSync(feasibility,JSON.stringify(d.feasibility));
 writeFileSync(bom,JSON.stringify(sbom(lb),null,2)+'\n');
 return {folder,lock,audit,feasibility,bom,ledger};
}
const argv=f=>[f.lock,f.audit,f.feasibility,f.bom];
function accept(f){
 capture(argv(f),f.ledger);verify(argv(f),f.ledger);
 return JSON.parse(readFileSync(f.ledger,'utf8'));
}
function blocked(f,pattern){
 assert.throws(()=>capture(argv(f),f.ledger),pattern);
 const r=spawnSync('node',[tool,'capture',...argv(f),f.ledger],{encoding:'utf8',timeout:10000});
 assert.equal(r.status,1,r.stderr+r.stdout);assert.match(r.stderr,pattern);
}
test('five HIGH npm advisories stay explicit with installed package versions and paths',t=>{
 const f=fixture(t),e=accept(f);
 assert.equal(e.productionApproved,false);
 assert.equal(e.counts.high,5);
 assert.equal(e.vulnerabilities.length,5);
 assert.deepEqual(e.vulnerabilities.map(v=>v.name).sort(),
  ['expo','expo-updates','@expo/cli','@expo/code-signing-certificates','node-forge'].sort());
 assert.equal(e.hashes.lockSha256,sha(readFileSync(f.lock)));
 assert.equal(e.hashes.auditSha256,sha(readFileSync(f.audit)));
 assert.equal(e.hashes.sbomSha256,sha(readFileSync(f.bom)));
 assert.equal(e.vulnerabilities.find(v=>v.name==='node-forge').lockedVersions[0].version,'1.4.0');
 assert.match(e.status,/STABLE RELEASE BLOCKED/);
});
test('CLI generates deterministic evidence and independent verification',t=>{
 const f=fixture(t);
 let r=spawnSync('node',[tool,'capture',...argv(f),f.ledger],{encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr);
 const bytes=readFileSync(f.ledger);rmSync(f.ledger);
 capture(argv(f),f.ledger);assert.deepEqual(readFileSync(f.ledger),bytes);
 r=spawnSync('node',[tool,'verify',...argv(f),f.ledger],{encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr);
});
test('modified npm audit counts or removed advisory cannot pass',t=>{
 blocked(fixture(t,d=>d.audit.metadata.vulnerabilities.total=4),/counts do not add up/);
 blocked(fixture(t,d=>delete d.audit.vulnerabilities['expo']),/omitted or inserted/);
 blocked(fixture(t,d=>d.audit.metadata.vulnerabilities.moderate=1),/counts do not add up/);
});
test('attempted advisory downgrade cannot hide unresolved HIGH risk',t=>{
 blocked(fixture(t,d=>{d.audit.vulnerabilities['expo'].severity='low';}),/severity mismatch/);
 blocked(fixture(t,d=>{d.audit.vulnerabilities['node-forge'].via=[];}),/missing advisory causality/);
});
test('advisories must point to actual locked components and versions',t=>{
 blocked(fixture(t,d=>d.audit.vulnerabilities['expo'].nodes=['node_modules/ghost']),/node name mismatch/);
 blocked(fixture(t,d=>d.audit.vulnerabilities['expo'].nodes=['node_modules/expo/node_modules/expo']),/missing locked SBOM component/);
});
test('transitive via and reverse effects must point to known advisories',t=>{
 blocked(fixture(t,d=>d.audit.vulnerabilities['expo'].via=['nonexistent-package']),/unresolved transitive advisory link/);
 blocked(fixture(t,d=>d.audit.vulnerabilities['node-forge'].effects=['ghost']),/unresolved reverse advisory effect/);
});
test('root advisory URL cannot be swapped to an unrelated or fake advisory',t=>{
 blocked(fixture(t,d=>d.audit.vulnerabilities['node-forge'].via[0].url='https://evil.test/a'),/invalid primary advisory entry/);
 blocked(fixture(t,d=>d.audit.vulnerabilities['node-forge'].via[0].url='https://github.com/advisories/GHSA-aaaa-bbbb-cccc'),/root npm advisory identity changed/);
});
test('false SBOM package version causes a hard block before ledger issuance',t=>{
 const f=fixture(t);const doc=JSON.parse(readFileSync(f.bom,'utf8'));
 doc.components.find(x=>x.name==='node-forge').version='9.9.9';
 writeFileSync(f.bom,JSON.stringify(doc));
 blocked(f,/SBOM does not match exact npm lockfile/);
});
test('modified source audit, BOM or lock after ledger capture rejects downloaded evidence',t=>{
 for(const field of ['audit','bom','lock']){
  const f=fixture(t);capture(argv(f),f.ledger);
  const data=readFileSync(f[field]);writeFileSync(f[field],Buffer.concat([data,Buffer.from(' ')]));
  assert.throws(()=>verify(argv(f),f.ledger),/downloaded advisory evidence differs/);
 }
});
test('forged approval, extra packages or removed vulnerabilities in downloaded ledger are detected',t=>{
 const f=fixture(t);capture(argv(f),f.ledger);
 const ledger=JSON.parse(readFileSync(f.ledger,'utf8'));
 ledger.productionApproved=true;ledger.vulnerabilities.pop();
 writeFileSync(f.ledger,JSON.stringify(ledger));
 assert.throws(()=>verify(argv(f),f.ledger),/downloaded advisory evidence differs/);
});
test('symlinked and duplicated JSON audit reports cannot pass',t=>{
 const f=fixture(t),link=join(f.folder,'audit-link.json');symlinkSync(f.audit,link);
 // The parser can validate byte buffers; only file-backed capture enforces anti-symlink checks.
 assert.throws(()=>capture([f.lock,link,f.feasibility,f.bom],f.ledger),/missing, linked or oversized/);
 const altered=readFileSync(f.audit,'utf8').replace('"auditReportVersion":2','"auditReportVersion":2,"auditReportVersion":2');
 writeFileSync(f.audit,altered);
 blocked(f,/unparseable\/duplicate-key npm audit/);
});
test('workflow generates and independently re-verifies advisory ledger from exact downloaded inputs',()=>{
 const workflow=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 assert.match(workflow,/lab\/p01-downloaded-sbom-advisory-ledger-v1/);
 const build=workflow.slice(workflow.indexOf('  assemble-combined-lab-apk:'),workflow.indexOf('  reverify-downloaded-combined-apk:'));
 const check=workflow.slice(workflow.indexOf('  reverify-downloaded-combined-apk:'));
 assert.match(build,/npm_audit_sbom_ledger\.cjs capture/);
 assert.match(build,/image-size-review\/image-size-candidate-audit\.json/);
 assert.match(build,/apps\/mobile\/NPM_ADVISORY_LEDGER\.json/);
 assert.match(check,/npm_audit_sbom_ledger\.cjs verify/);
 assert.match(check,/combined-apk\/NPM_ADVISORY_LEDGER\.json/);
 assert.ok(check.indexOf('npm_lock_cyclonedx_sbom.cjs verify')<check.indexOf('npm_audit_sbom_ledger.cjs verify'));
 assert.ok(check.indexOf('npm_audit_sbom_ledger.cjs verify')<check.indexOf('verify_compiled_ota_runtime.py'));
 assert.match(check,/permissions:\s*\n\s+contents: read/);
 assert.doesNotMatch(check,/npm install|npm ci|secrets\.|contents: write|gh release|git push/);
});
