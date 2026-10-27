import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url);
const {produce,run,scan}=require('../tooling/android/expo_certificate_symbol_inventory.cjs');
const commit='c'.repeat(40);
const versions={'expo':'54.0.38','expo-updates':'29.0.20','@expo/cli':'54.0.28',
 '@expo/code-signing-certificates':'0.0.6','node-forge':'1.4.0'};
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'negresco-expo-symbols-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const modules=join(root,'node_modules');mkdirSync(modules,{recursive:true});const pkgs={};
 for(const [name,version] of Object.entries(versions)){
  const folder=join(modules,name);mkdirSync(folder,{recursive:true});
  writeFileSync(join(folder,'package.json'),JSON.stringify({name,version}));
  let code='module.exports = true;';
  if(name==='@expo/code-signing-certificates')
   code="const forge = require('node-forge');\n"+
   "function validateSelfSignedCertificate(c) { c.verify(c); }\n"+
   "function signBufferRSASHA256AndVerify(k,c) { return c.publicKey.verify(k); }\n"+
   "function generateDevelopmentCertificateFromCSR(csr) { csr.verify(); }\n";
  if(name==='@expo/cli')
   code="const x = require('@expo/code-signing-certificates');\n"+
   "x.validateSelfSignedCertificate(certificate);\n"+
   "const unused = 'signBufferRSASHA256AndVerify';\n";
  writeFileSync(join(folder,'index.js'),code);pkgs['node_modules/'+name]={version};
 }
 const lock=join(root,'lock.json'),report=join(root,'EXPO_CERT_API_SYMBOLS.json');
 writeFileSync(lock,JSON.stringify({name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages:pkgs}));
 return {modules,lock,report};
}
test('symbol mentions, member calls and declarations are separate, without disclosing raw source',t=>{
 const f=fixture(t),result=produce(f.modules,f.lock,commit);
 const lib=result.packages.find(p=>p.package==='@expo/code-signing-certificates');
 const cli=result.packages.find(p=>p.package==='@expo/cli');
 assert.equal(lib.symbols.validateSelfSignedCertificate.declarations,1);
 assert.equal(cli.symbols.validateSelfSignedCertificate.memberCallSyntax,1);
 assert.equal(cli.symbols.signBufferRSASHA256AndVerify.mentions,1);
 assert.equal(cli.symbols.signBufferRSASHA256AndVerify.callSyntax,0);
 assert.equal(cli.moduleSpecifierMentions.expoCertificatePackage,1);
 assert.equal(result.stableReleaseAllowed,false);
 assert.doesNotMatch(JSON.stringify(result),/index\.js|certificate\);|module\.exports/);
});
test('second installation matches exact report and detects modified installed sources',t=>{
 const f=fixture(t);run(['capture',f.modules,f.lock,commit,f.report]);
 assert.doesNotThrow(()=>run(['verify',f.modules,f.lock,commit,f.report]));
 writeFileSync(join(f.modules,'@expo/cli','index.js'),"const x=require('@expo/code-signing-certificates'); module.exports = 3;");
 assert.throws(()=>run(['verify',f.modules,f.lock,commit,f.report]),/does not reproduce/);
});
test('malformed installed source fails closed',t=>{
 const f=fixture(t),folder=join(f.modules,'expo');
 assert.equal(scan(folder).scannedSourceFiles,1);
 writeFileSync(join(folder,'index.js'),'');
 assert.throws(()=>scan(folder),/unsafe source file/);
});
test('workflow runs in both isolated npm jobs and preserves final APK-only reauditor',()=>{
 const wf=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 const capture=wf.indexOf('      - name: Capture installed Expo certificate API symbol references');
 const upload=wf.indexOf('      - name: Upload host import report only');
 const verify=wf.indexOf('      - name: Re-derive Expo certificate API symbol references after fresh npm install');
 const apk=wf.lastIndexOf('\n  reverify-downloaded-combined-apk:');
 assert.ok(capture>0&&upload>capture&&verify>upload&&apk>verify);
 assert.match(wf.slice(capture,upload),/expo_certificate_symbol_inventory\.cjs capture/);
 assert.match(wf.slice(verify,apk),/expo_certificate_symbol_inventory\.cjs verify/);
 assert.match(wf.slice(upload,verify),/HOST_EXPO_CERTIFICATE_API_REFERENCES\.json/);
 assert.doesNotMatch(wf.slice(upload,verify),/path:\s+apps\/mobile\/node_modules/);
});
