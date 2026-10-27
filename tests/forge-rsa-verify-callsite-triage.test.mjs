import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url);
const {inspect,produce,run}=require('../tooling/android/forge_rsa_verify_callsite_triage.cjs');
const commit='d'.repeat(40);
const versions={'expo':'54.0.38','expo-updates':'29.0.20',
 '@expo/cli':'54.0.28','@expo/code-signing-certificates':'0.0.6','node-forge':'1.4.0'};
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'negresco-rsa-call-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const modules=join(root,'node_modules');mkdirSync(modules,{recursive:true});
 const pkgs={};
 for(const [name,version] of Object.entries(versions)){
  const loc=join(modules,name);mkdirSync(loc,{recursive:true});
  writeFileSync(join(loc,'package.json'),JSON.stringify({name,version}));
  let source='module.exports = true;';
  if(name==='@expo/code-signing-certificates')
   source="const forge = require('node-forge');\n"+
    "const actual = certificate.publicKey.verify(digest, sig);\n"+
    "const cert = certificate.verify(certificate);\n"+
    "const other = thing.verify(x);\n";
  if(name==='@expo/cli')source="import {pki} from 'node-forge'; const ok = csr.verify();";
  writeFileSync(join(loc,'main.js'),source);
  pkgs['node_modules/'+name]={version};
 }
 const lock=join(root,'package-lock.json'),report=join(root,'RSA_VERIFY_CALLSITE_TRIAGE.json');
 writeFileSync(lock,JSON.stringify({name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages:pkgs}));
 return {root,modules,lock,report};
}
test('identifies publicKey.verify distinct from unrelated generic verify calls',t=>{
 const f=fixture(t);
 const r=inspect(join(f.modules,'@expo/code-signing-certificates'));
 assert.equal(r.callsiteTokens.publicKeyVerify,1);
 assert.equal(r.callsiteTokens.certificateVerify,1);
 assert.equal(r.callsiteTokens.genericVerify,3);
 assert.equal(r.sameFileIndicators.forgeImportAndPublicKeyVerify,1);
 assert.equal(r.candidateFiles.length,1);
 assert.doesNotMatch(JSON.stringify(r),/main\.js|digest, sig|module\.exports/);
});
test('independent installation and tampering contracts',t=>{
 const f=fixture(t),x=produce(f.modules,f.lock,commit);
 assert.equal(x.stableReleaseAllowed,false);
 const p=x.packages.find(p=>p.package==='@expo/code-signing-certificates');
 assert.equal(p.callsiteTokens.publicKeyVerify,1);
 run(['capture',f.modules,f.lock,commit,f.report]);
 run(['verify',f.modules,f.lock,commit,f.report]);
 const loc=join(f.modules,'@expo/code-signing-certificates','main.js');
 writeFileSync(loc,"const forge = require('node-forge'); module.exports = false;");
 assert.throws(()=>run(['verify',f.modules,f.lock,commit,f.report]),/did not reproduce/);
});
test('workflow verifies call-site inventory on second pinned npm ci before APK-only audit',()=>{
 const yaml=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 const cap=yaml.indexOf('      - name: Capture RSA signature-verification call-site candidates');
 const upload=yaml.indexOf('      - name: Upload host import report only');
 const verify=yaml.indexOf('      - name: Reverify RSA signature-verification call-site candidates');
 const last=yaml.lastIndexOf('\n  reverify-downloaded-combined-apk:');
 assert.ok(cap>0&&upload>cap&&verify>upload&&last>verify);
 assert.match(yaml.slice(cap,upload),/forge_rsa_verify_callsite_triage\.cjs capture/);
 assert.match(yaml.slice(verify,last),/forge_rsa_verify_callsite_triage\.cjs verify/);
 assert.match(yaml.slice(upload,verify),/HOST_FORGE_RSA_VERIFY_CALLSITES\.json/);
 assert.doesNotMatch(yaml.slice(upload,verify),/path:\s+apps\/mobile\/node_modules/);
});
