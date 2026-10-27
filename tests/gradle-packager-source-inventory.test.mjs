import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {capture,verify,countMap}=require('../tooling/android/gradle_packager_source_inventory.cjs');
const hash=require('node:crypto').createHash;
const commit='a'.repeat(40);
const sha=b=>hash('sha256').update(b).digest('hex');
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'negresco-gradlemap-'));
 t.after(()=>rmSync(dir,{force:true,recursive:true}));
 const map=join(dir,'index.android.bundle.packager.map'),apk=join(dir,'app.apk');
 const lock=join(dir,'package-lock.json'),hermes=join(dir,'APK_HERMES_BUNDLE_INVENTORY.json');
 const report=join(dir,'GRADLE_PACKAGER_SOURCE_INVENTORY.json');
 writeFileSync(apk,'test-only synthetic apk, never for installation');
 writeFileSync(lock,JSON.stringify({lockfileVersion:3,packages:{
  'node_modules/node-forge':{version:'1.4.0'},
  'node_modules/@expo/code-signing-certificates':{version:'0.0.6'}
 }}));
 writeFileSync(hermes,JSON.stringify({schemaVersion:1,approvedForProduction:false,
  sourceCommit:commit,apkSha256:sha(readFileSync(apk)),
  nativeBinaryInventorySha256:'b'.repeat(64),jsPayload:{kind:'hermes-bytecode',sha256:'c'.repeat(64)}}));
 writeFileSync(map,JSON.stringify({version:3,sources:[
  '../src/App.tsx','../node_modules/node-forge/lib/rsa.js',
  '../node_modules/@expo/cli/build/start.js','../node_modules/react/index.js'
 ],sourcesContent:['private text not exported'],mappings:''}));
 return {map,apk,lock,hermes,report};
}
test('same-build Gradle map classified but source names and contents never written to report',t=>{
 const f=fixture(t);
 const inv=capture(f.map,f.apk,f.lock,f.hermes,commit,f.report);
 assert.equal(inv.observedGradlePackager.sourceCount,4);
 assert.equal(inv.observedGradlePackager.packageCounts.nodeForge,1);
 assert.equal(inv.observedGradlePackager.packageCounts.expoCli,1);
 assert.equal(inv.approvedForProduction,false);
 assert.doesNotMatch(readFileSync(f.report,'utf8'),/rsa\.js|App\.tsx|private text/);
 assert.equal(verify(f.apk,f.lock,f.hermes,commit,f.report),true);
});
test('downloaded data tampering, counts and extra fields fail closed',t=>{
 const f=fixture(t),inv=capture(f.map,f.apk,f.lock,f.hermes,commit,f.report);
 const change=(fn)=>{
  const j=structuredClone(inv);fn(j);writeFileSync(f.report,JSON.stringify(j));
  assert.throws(()=>verify(f.apk,f.lock,f.hermes,commit,f.report),/BLOCK:/);
 };
 change(x=>{x.approvedForProduction=true});
 change(x=>{x.productionReleaseAllowed=true});
 change(x=>{x.observedGradlePackager.packageCounts.nodeForge=9999});
 change(x=>{x.sourceCommit='f'.repeat(40)});
 change(x=>{x.sourceContent='do not leak'});
 writeFileSync(f.report,JSON.stringify(inv));
 writeFileSync(f.apk,'APK modified');
 assert.throws(()=>verify(f.apk,f.lock,f.hermes,commit,f.report),/provenance mismatch/);
});
test('missing, empty or forged map fails closed',t=>{
 const f=fixture(t);
 assert.equal(countMap(f.map).packageCounts.nodeForge,1);
 writeFileSync(f.map,JSON.stringify({version:3,sources:['one']}));
 assert.throws(()=>countMap(f.map),/malformed/);
 const wrong=join(f.map.replace('packager.map','compiler.map'));
 writeFileSync(wrong,JSON.stringify({version:3,sources:['aa','bb']}));
 assert.throws(()=>countMap(wrong),/not canonical/);
});
test('same-build Gradle packager map is captured after Hermes and checked in independent job',()=>{
 const wf=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 assert.match(wf,/lab\/p01-gradle-packager-js-map-inventory-v1/);
 assert.match(wf,/android\/app\/build\/intermediates\/sourcemaps\/react\/release\/index\.android\.bundle\.packager\.map/);
 const hash=wf.indexOf('      - name: Hash exact Hermes JS bytecode inside verified APK');
 const summary=wf.indexOf('      - name: Inventory Gradle-generated Metro packager map');
 const download=wf.indexOf('      - name: Download APK from the same workflow run');
 const verify=wf.indexOf('      - name: Independently validate Gradle-packager source summary');
 assert.ok(hash>=0&&summary>hash&&download>summary&&verify>download);
 assert.match(wf,/GRADLE_PACKAGER_SOURCE_INVENTORY\.json/);
 const upload=wf.slice(wf.indexOf('      - name: Upload APK as short-lived unreviewed artifact'),wf.indexOf('  reverify-downloaded-combined-apk:'));
 assert.doesNotMatch(upload,/\.packager\.map|\.hbc\.map|\.compiler\.map/);
});
