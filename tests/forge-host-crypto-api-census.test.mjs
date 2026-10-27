import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {make,run,countDir}=require('../tooling/android/forge_host_crypto_api_census.cjs');
const commit='d'.repeat(40);
const versions={'expo':'54.0.38','expo-updates':'29.0.20',
 '@expo/cli':'54.0.28','@expo/code-signing-certificates':'0.0.6','node-forge':'1.4.0'};
function fixture(t){
 const p=mkdtempSync(join(tmpdir(),'negresco-crypto-census-'));
 t.after(()=>rmSync(p,{recursive:true,force:true}));
 const modules=join(p,'node_modules');mkdirSync(modules,{recursive:true});
 const lock=join(p,'lock.json'),output=join(p,'CRYPTO_API_CENSUS.json');
 const packages={};
 for(const [name,version] of Object.entries(versions)){
  const folder=join(modules,name);mkdirSync(folder,{recursive:true});
  writeFileSync(join(folder,'package.json'),JSON.stringify({name,version}));
  writeFileSync(join(folder,'main.js'),name==='@expo/code-signing-certificates'?
    "const forge = require('node-forge');\nconst c=forge.pki.certificateFromPem('TEST'); const x=forge.md.sha256.create(); const y=c.verify(x);"
   :name==='@expo/cli'?"import {pki as PKI} from 'node-forge'; const k=PKI.privateKeyFromPem('TEST'); const s=k.sign({});"
   :"module.exports = true;");
  packages['node_modules/'+name]={version};
 }
 writeFileSync(lock,JSON.stringify({name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages}));
 return {modules,lock,output};
}
test('classifies lexical APIs but stores neither source paths nor snippets',t=>{
 const f=fixture(t),v=make(f.modules,f.lock,commit);
 assert.equal(v.scannedPackages.length,5);
 assert.equal(v.approvedForProduction,false);
 assert.equal(v.stableReleaseAllowed,false);
 const cert=v.scannedPackages.find(p=>p.package==='@expo/code-signing-certificates');
 const cli=v.scannedPackages.find(p=>p.package==='@expo/cli');
 assert.equal(cert.apiTokenCounts.pkiCertificateFromPem,1);
 assert.equal(cert.apiTokenCounts.sha256DigestFactory,1);
 assert.equal(cert.apiTokenCounts.genericVerifyMethodCall,1);
 assert.equal(cli.apiTokenCounts.pkiPrivateKeyFromPem,1);
 assert.equal(cli.apiTokenCounts.genericSignMethodCall,1);
 assert.doesNotMatch(JSON.stringify(v),/main\.js|TEST|module\.exports/);
});
test('fresh independent installed-package inspection detects changed APIs and source bytes',t=>{
 const f=fixture(t);run(['capture',f.modules,f.lock,commit,f.output]);
 run(['verify',f.modules,f.lock,commit,f.output]);
 writeFileSync(join(f.modules,'expo','main.js'),'module.exports = false;');
 assert.throws(()=>run(['verify',f.modules,f.lock,commit,f.output]),/independent host crypto API census differed/);
});
test('source enumeration and installed package versions must fail closed',t=>{
 const f=fixture(t);
 assert.equal(countDir(join(f.modules,'expo')).scannedSourceFiles,1);
 const lock=JSON.parse(readFileSync(f.lock));
 lock.packages['node_modules/node-forge'].version='1.4.1';
 writeFileSync(f.lock,JSON.stringify(lock));
 assert.throws(()=>make(f.modules,f.lock,commit),/version changed/);
});
test('same two independent npm ci jobs produce and verify crypto census without uploading sources',()=>{
 const yaml=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 const capture=yaml.indexOf('      - name: Capture exact host crypto API lexical census');
 const upload=yaml.indexOf('      - name: Upload host import report only');
 const verify=yaml.indexOf('      - name: Reverify exact host crypto API lexical census');
 const lastJob=yaml.lastIndexOf('\n  reverify-downloaded-combined-apk:');
 assert.ok(capture>=0&&upload>capture&&verify>upload&&lastJob>verify);
 assert.match(yaml.slice(capture,upload),/forge_host_crypto_api_census\.cjs capture/);
 assert.match(yaml.slice(verify,lastJob),/forge_host_crypto_api_census\.cjs verify/);
 assert.match(yaml.slice(upload,verify),/HOST_FORGE_IMPORT_INVENTORY\.json/);
 assert.match(yaml.slice(upload,verify),/HOST_FORGE_CRYPTO_API_CENSUS\.json/);
 assert.doesNotMatch(yaml.slice(upload,verify),/path:\s+apps\/mobile\/node_modules/);
});
