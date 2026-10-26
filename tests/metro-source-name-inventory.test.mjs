import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {collect,produce,verify}=require('../tooling/android/metro_source_name_inventory.cjs');
const head='c'.repeat(40),h='a'.repeat(64);
function fixture(t) {
 const dir=mkdtempSync(join(tmpdir(),'negresco-metro-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const maps=join(dir,'export');mkdirSync(maps);
 const lock=join(dir,'package-lock.json'),hermes=join(dir,'hermes.json');
 writeFileSync(lock,JSON.stringify({lockfileVersion:3,packages:{
  'node_modules/node-forge':{version:'1.4.0'},
  'node_modules/@expo/code-signing-certificates':{version:'0.0.6'}}}));
 writeFileSync(hermes,JSON.stringify({schemaVersion:1,approvedForProduction:false,sourceCommit:head,
  apkSha256:h,nativeBinaryInventorySha256:h,jsPayload:{sha256:h,kind:'hermes-bytecode'}}));
 return {maps,lock,hermes};
}
function writeMap(dir,sources){writeFileSync(join(dir,'android.js.map'),JSON.stringify({version:3,sources,mappings:''}));}
test('source names identify precise packages without distributing sourcesContent',t=>{
 const f=fixture(t);writeMap(f.maps,[
  '../node_modules/expo-updates/build/Updates.js',
  '../node_modules/@expo/code-signing-certificates/build/main.js',
  '../node_modules/node-forge/lib/rsa.js',
  '../src/App.tsx'
 ]);
 const evidence=produce(f.maps,f.lock,f.hermes,head);
 assert.equal(evidence.observedExport.sourceCount,4);
 assert.deepEqual(evidence.observedExport.observedModuleSourceCounts,{
  nodeForge:1,expoCli:0,codeSigningCertificates:1,expoUpdates:1
 });
 assert.equal(evidence.approvedForProduction,false);
 assert.equal(evidence.advisory.productionReleaseAllowed,false);
 assert.match(evidence.method,/SEPARATE_EXPO_EXPORT/);
 assert.doesNotMatch(JSON.stringify(evidence),/rsa\.js|App\.tsx|sourcesContent/);
});
test('source map absent or malformed must not count as clean runtime',t=>{
 const f=fixture(t);assert.throws(()=>collect(f.maps),/expected 1-40/);
 writeMap(f.maps,['one']);assert.throws(()=>collect(f.maps),/malformed/);
 writeMap(f.maps,['../src/App.tsx','../node_modules/react/index.js']);
 assert.equal(collect(f.maps).observedModuleSourceCounts.nodeForge,0);
});
test('source lock or APK evidence tampering fails closed',t=>{
 const f=fixture(t);writeMap(f.maps,['app.js','../node_modules/react/index.js']);
 assert.throws(()=>produce(f.maps,f.lock,f.hermes,'f'.repeat(40)),/Hermes provenance/);
 const bad=JSON.parse(readFileSync(f.lock));bad.packages['node_modules/node-forge'].version='1.4.1';
 writeFileSync(f.lock,JSON.stringify(bad));assert.throws(()=>produce(f.maps,f.lock,f.hermes,head),/vulnerable npm graph changed/);
});
test('CI must export source maps without uploading raw source maps',()=>{
 const s=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 assert.match(s,/lab\/p01-metro-js-module-inventory-v1/);
 assert.match(s,/npx expo export --platform android --source-maps --no-bytecode/);
 assert.match(s,/metro_source_name_inventory\.cjs capture/);
 assert.match(s,/apps\/mobile\/METRO_JS_SOURCE_NAME_INVENTORY\.json/);
 const upload=s.slice(s.indexOf('      - name: Upload APK as short-lived unreviewed artifact'),
   s.indexOf('  reverify-downloaded-combined-apk:'));
 assert.doesNotMatch(upload,/\.js\.map|\.hbc\.map|source-map\.json/);
});

test('independent downloaded report verifier binds exact APK, lock, Hermes and refuses tampering',t=>{
 const f=fixture(t);writeMap(f.maps,['../src/App.tsx','../node_modules/node-forge/lib/rsa.js']);
 const apk=join(f.maps,'app-release.apk');writeFileSync(apk,Buffer.from('separate synthetic APK fixture'));
 const hash=require('node:crypto').createHash('sha256');
 hash.update(readFileSync(apk));const apkSha=hash.digest('hex');
 const originalHermes=JSON.parse(readFileSync(f.hermes,'utf8'));
 originalHermes.apkSha256=apkSha;writeFileSync(f.hermes,JSON.stringify(originalHermes));
 const report=join(f.maps,'METRO_JS_SOURCE_NAME_INVENTORY.json');
 const original=produce(f.maps,f.lock,f.hermes,head);
 writeFileSync(report,JSON.stringify(original));
 assert.equal(verify(apk,f.lock,f.hermes,head,report),true);
 const mutate=(fn,pattern)=>{
  const d=structuredClone(original);fn(d);writeFileSync(report,JSON.stringify(d));
  assert.throws(()=>verify(apk,f.lock,f.hermes,head,report),pattern);
 };
 mutate(d=>{d.approvedForProduction=true},/bound to exact/);
 mutate(d=>{d.sourceCommit='f'.repeat(40)},/bound to exact/);
 mutate(d=>{d.observedExport.sourceCount=-1},/unsafe source map summary/);
 mutate(d=>{d.observedExport.observedModuleSourceCounts.nodeForge=99999},/unsafe source map summary/);
 mutate(d=>{d.leakedSourceContent='secret'},/unexpected fields/);
 mutate(d=>{d.apkSha256='0'.repeat(64)},/bound to exact/);
 writeFileSync(report,JSON.stringify(original));writeFileSync(apk,'tampered bytes');
 assert.throws(()=>verify(apk,f.lock,f.hermes,head,report),/Hermes provenance/);
});

test('the separate verifier runs after independent Hermes APK verification',()=>{
 const s=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 const a=s.indexOf('      - name: Reverify downloaded APK Hermes JS payload and native provenance');
 const b=s.indexOf('      - name: Revalidate Metro summary against downloaded APK and npm graph');
 const c=s.indexOf('      - name: Reaudit compiled preview runtime');
 assert.ok(a>=0&&b>a&&c>b);
 assert.match(s.slice(b,c),/metro_source_name_inventory\.cjs verify/);
 assert.match(s.slice(b,c),/combined-apk\/METRO_JS_SOURCE_NAME_INVENTORY\.json/);
});
