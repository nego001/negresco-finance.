import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url);
const {scan,produce,run}=require('../tooling/android/expo_cert_import_call_boundaries.cjs');
const commit='c'.repeat(40);
const versions={'expo':'54.0.38','expo-updates':'29.0.20',
 '@expo/cli':'54.0.28','@expo/code-signing-certificates':'0.0.6','node-forge':'1.4.0'};
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'negresco-boundary-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const modules=join(root,'node_modules');mkdirSync(modules,{recursive:true});
 const packages={};
 for(const [name,version] of Object.entries(versions)){
  const folder=join(modules,name);mkdirSync(folder,{recursive:true});
  writeFileSync(join(folder,'package.json'),JSON.stringify({name,version}));
  let s='module.exports = true;';
  if(name==='@expo/code-signing-certificates')s=
    "const forge=require('node-forge'); function validateSelfSignedCertificate(c){ c.verify(c); }";
  if(name==='expo-updates')s=
    "const c=require('@expo/code-signing-certificates'); c.validateSelfSignedCertificate(cert);";
  if(name==='@expo/cli')s=
    "const x='validateSelfSignedCertificate'; const c=require('@expo/code-signing-certificates');";
  writeFileSync(join(folder,'index.js'),s);
  packages['node_modules/'+name]={version};
 }
 const lock=join(root,'lock.json'),out=join(root,'REPORT.json');
 writeFileSync(lock,JSON.stringify({name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages}));
 return {modules,lock,out};
}
test('co-located import/call differs from a mere symbol mention',t=>{
 const f=fixture(t);const a=produce(f.modules,f.lock,commit);
 const up=a.packages.find(p=>p.package==='expo-updates');
 const cli=a.packages.find(p=>p.package==='@expo/cli');
 assert.equal(up.symbols.validateSelfSignedCertificate.filesWithLiteralImportAndCall,1);
 assert.equal(cli.symbols.validateSelfSignedCertificate.filesWithLiteralImportAndCall,0);
 assert.equal(cli.symbols.validateSelfSignedCertificate.filesWithSpecifierAndName,1);
 assert.equal(a.stableReleaseAllowed,false);
 assert.doesNotMatch(JSON.stringify(a),/index\.js|module\.exports|cert\);/);
});
test('independent reproduction detects source edits',t=>{
 const f=fixture(t);run(['capture',f.modules,f.lock,commit,f.out]);
 run(['verify',f.modules,f.lock,commit,f.out]);
 writeFileSync(join(f.modules,'expo','index.js'),'module.exports = false;');
 assert.throws(()=>run(['verify',f.modules,f.lock,commit,f.out]),/mismatch/);
});
test('workflow includes producer and independent check before APK-only verifier',()=>{
 const yaml=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 const a=yaml.indexOf('Capture installed Expo certificate import/call co-location');
 const b=yaml.indexOf('Independently rederive installed Expo import/call co-location');
 const c=yaml.lastIndexOf('\n  reverify-downloaded-combined-apk:');
 assert.ok(a>0&&b>a&&c>b);
 assert.match(yaml,/HOST_EXPO_CERT_IMPORT_CALL_BOUNDARIES\.json/);
 assert.match(yaml,/expo_cert_import_call_boundaries\.cjs verify/);
});
