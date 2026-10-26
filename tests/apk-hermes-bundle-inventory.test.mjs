import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const tool=resolve('tooling/android/apk_hermes_bundle_inventory.py');
const commit='a'.repeat(40);
const hash=b=>createHash('sha256').update(b).digest('hex');
const hermes=()=>{const b=Buffer.concat([Buffer.from('c61fbc03c103191f','hex'),Buffer.alloc(4),Buffer.alloc(64)]);b.writeUInt32LE(96,8);return b;};
const normal=()=>[{name:'assets/index.android.bundle',payload:hermes().toString('hex')},{name:'classes.dex',payload:'6465780a30333900'},{name:'lib/arm64-v8a/libtest.so',payload:'7f454c4602'}];
const pyZip=['import json,sys,zipfile','d=json.loads(sys.stdin.read())','with zipfile.ZipFile(sys.argv[1],"w") as f:',' for e in d:','  f.writestr(e["name"],bytes.fromhex(e["payload"]))'].join('\n');
function fixture(t,entries=normal()){
  const dir=mkdtempSync(join(tmpdir(),'negresco-hermes-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const apk=join(dir,'app.apk'),native=join(dir,'native.json'),out=join(dir,'js.json');
  const z=spawnSync('python3',['-c',pyZip,apk],{input:JSON.stringify(entries),encoding:'utf8',timeout:12000});
  assert.equal(z.status,0,z.stderr);
  writeFileSync(native,JSON.stringify({schemaVersion:1,approvedForProduction:false,sourceCommit:commit,apkSha256:hash(readFileSync(apk)),gradleReportSha256:'b'.repeat(64),packagedBinaries:[{path:'classes.dex',sha256:'c'.repeat(64)}]}));
  return {apk,native,out};
}
const run=(mode,f,sha=commit,path=f.out)=>spawnSync('python3',[tool,mode,f.apk,f.native,sha,path],{encoding:'utf8',timeout:20000});
const reject=(t,entries,rx)=>{const f=fixture(t,entries);const r=run('capture',f);assert.equal(r.status,1,r.stderr);assert.match(r.stderr,rx);};
test('reads exact Hermes SHA, version and native-APK provenance then independently verifies',t=>{
  const f=fixture(t),c=run('capture',f);assert.equal(c.status,0,c.stderr);
  const d=JSON.parse(readFileSync(f.out,'utf8'));
  assert.equal(d.jsPayload.hermesBytecodeVersion,96);
  assert.equal(d.jsPayload.sha256,hash(hermes()));
  assert.equal(d.nativeBinaryInventorySha256,hash(readFileSync(f.native)));
  assert.equal(d.approvedForProduction,false);
  assert.match(d.scope,/NOT JS MODULE REACHABILITY/);
  assert.equal(run('verify',f).status,0);
});
test('rejects missing, duplicate, altered-magic and invalid-version Hermes payload',t=>{
  reject(t,normal().slice(1),/exactly one canonical/);
  reject(t,[...normal(),normal()[0]],/exactly one canonical/);
  reject(t,normal().map(e=>e.name==='assets/index.android.bundle'?{...e,payload:'00'.repeat(76)}:e),/not Hermes bytecode/);
  const invalid=Buffer.from(hermes());invalid.writeUInt32LE(1,8);
  reject(t,normal().map(e=>e.name==='assets/index.android.bundle'?{...e,payload:invalid.toString('hex')}:e),/unexpected Hermes bytecode/);
});
test('refuses APK, native inventory, output and commit tampering',t=>{
  for(const type of ['apk','native','out','commit']){
    const f=fixture(t);assert.equal(run('capture',f).status,0);
    if(type!=='commit')writeFileSync(f[type],Buffer.concat([readFileSync(f[type]),Buffer.from('x')]));
    const r=run('verify',f,type==='commit'?'d'.repeat(40):commit);
    assert.equal(r.status,1,r.stderr);
    assert.match(r.stderr,/BLOCK: APK Hermes payload/);
  }
});
test('refuses overwrite and symlink evidence',t=>{
  const f=fixture(t);assert.equal(run('capture',f).status,0);
  assert.match(run('capture',f).stderr,/refusing to overwrite/);
  const link=f.out+'.link';symlinkSync(f.out,link);
  const r=run('verify',f,commit,link);
  assert.equal(r.status,1);assert.match(r.stderr,/linked or invalid/);
});
test('producer and independent downloaded APK must verify exact Hermes bytes',()=>{
  const wf=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
  assert.match(wf,/lab\/p01-apk-hermes-bundle-inventory-v1/);
  const producer=wf.slice(wf.indexOf('  assemble-combined-lab-apk:'),wf.indexOf('  reverify-downloaded-combined-apk:'));
  const verifier=wf.slice(wf.indexOf('  reverify-downloaded-combined-apk:'));
  assert.match(producer,/apk_hermes_bundle_inventory\.py capture/);
  assert.match(producer,/apps\/mobile\/APK_HERMES_BUNDLE_INVENTORY\.json/);
  assert.match(verifier,/apk_hermes_bundle_inventory\.py verify/);
  assert.match(verifier,/combined-apk\/APK_HERMES_BUNDLE_INVENTORY\.json/);
  assert.ok(verifier.indexOf('apk_hermes_bundle_inventory.py verify')<verifier.indexOf('verify_compiled_ota_runtime.py'));
  assert.doesNotMatch(verifier,/npm ci|npm install|gradlew|contents: write|secrets\.|gh release/);
});
