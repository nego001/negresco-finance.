import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';

const script=resolve('tooling/android/apk_packaged_binary_inventory.py');
const commit='a'.repeat(40);
const hash=b=>createHash('sha256').update(b).digest('hex');
const python='python3';
const basic=[
  {path:'classes.dex',value:'dex contents'},
  {path:'classes2.dex',value:'second dex'},
  {path:'lib/arm64-v8a/libsecurity.so',value:'secure ELF bytes'},
  {path:'lib/x86_64/libsecurity.so',value:'different x86 bytes'},
  {path:'assets/normal.txt',value:'not audited'},
];
function pyZip(path,entries){
  const body=`import json,sys,zipfile,stat,warnings
items=json.loads(sys.stdin.read())
with warnings.catch_warnings():
 warnings.simplefilter('ignore',UserWarning)
 with zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED) as archive:
  for spec in items:
   entry=zipfile.ZipInfo(spec['path'])
   entry.compress_type=zipfile.ZIP_DEFLATED
   if spec.get('symlink'):
    entry.create_system=3
    entry.external_attr=(stat.S_IFLNK|0o777)<<16
   archive.writestr(entry,spec.get('value','text').encode())`;
  const ret=spawnSync(python,['-c',body,path],{input:JSON.stringify(entries),encoding:'utf8',timeout:10000});
  assert.equal(ret.status,0,ret.stderr);
}
function command(args){return spawnSync(python,[script,...args],{encoding:'utf8',timeout:20000});}
function fixture(t,{files=basic,gradleCommit=commit}={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-packaged-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const apk=join(dir,'app-release.apk'),gradle=join(dir,'gradle.json'),inventory=join(dir,'binary.json');
  pyZip(apk,files);
  writeFileSync(gradle,JSON.stringify({schemaVersion:1,approvedForProduction:false,
    sourceCommit:gradleCommit,apkSha256:hash(readFileSync(apk)),
    gradleReportSha256:'b'.repeat(64)}));
  return {apk,gradle,inventory};
}
function capture(f){return command(['capture',f.apk,f.gradle,commit,f.inventory]);}
function verify(f){return command(['verify',f.apk,f.gradle,commit,f.inventory]);}
function denied(f,pattern){const r=capture(f);assert.equal(r.status,1,r.stdout+r.stderr);assert.match(r.stderr,pattern);}

test('hashes packaged DEX and .so for each ABI, excluding assets; independent rehash matches',t=>{
  const f=fixture(t);
  const created=capture(f);
  assert.equal(created.status,0,created.stderr);
  const obj=JSON.parse(readFileSync(f.inventory,'utf8'));
  assert.equal(obj.approvedForProduction,false);
  assert.equal(obj.zipEntryCount,5);
  assert.equal(obj.packagedDexCount,2);
  assert.equal(obj.packagedNativeLibraryCount,2);
  assert.deepEqual(obj.nativeAbis,['arm64-v8a','x86_64']);
  assert.deepEqual(obj.packagedBinaries.map(x=>x.path),[
    'classes.dex','classes2.dex','lib/arm64-v8a/libsecurity.so','lib/x86_64/libsecurity.so']);
  assert.equal(obj.packagedBinaries[0].sha256,hash(Buffer.from('dex contents')));
  assert.equal(obj.gradleInventorySha256,hash(readFileSync(f.gradle)));
  assert.equal(obj.apkSha256,hash(readFileSync(f.apk)));
  assert.equal(verify(f).status,0);
});
test('accepts multidex filenames classes10.dex and classes100.dex but blocks noncanonical names',t=>{
  const withMultidex=[...basic,
    {path:'classes10.dex',value:'tenth dex'},
    {path:'classes100.dex',value:'hundredth dex'}];
  const f=fixture(t,{files:withMultidex});
  const r=capture(f);
  assert.equal(r.status,0,r.stderr);
  const record=JSON.parse(readFileSync(f.inventory,'utf8'));
  assert.equal(record.packagedDexCount,4);
  assert.ok(record.packagedBinaries.some(x=>x.path==='classes10.dex'));
  assert.ok(record.packagedBinaries.some(x=>x.path==='classes100.dex'));
  assert.equal(verify(f).status,0);
  for(const bad of ['classes01.dex','classes1.dex','classes0.dex'])
    denied(fixture(t,{files:[...basic,{path:bad,value:'invalid dex'}]}),
      /unrecognized packaged DEX\/ELF location/);
});
test('rejects tampering to downloaded APK, Gradle inventory, binary hash evidence or commit',t=>{
  for(const attack of ['apk','gradle','inventory','commit']){
    const f=fixture(t);
    assert.equal(capture(f).status,0);
    if(attack==='apk')writeFileSync(f.apk,Buffer.concat([readFileSync(f.apk),Buffer.from('tampered')]));
    if(attack==='gradle')writeFileSync(f.gradle,readFileSync(f.gradle,'utf8')+' ');
    if(attack==='inventory')writeFileSync(f.inventory,readFileSync(f.inventory,'utf8')+' ');
    const r=attack==='commit'?command(['verify',f.apk,f.gradle,'c'.repeat(40),f.inventory]):verify(f);
    assert.equal(r.status,1,r.stdout+r.stderr);
    assert.match(r.stderr,/BLOCK: APK packaged binary inventory/);
  }
});
test('rejects ZIP duplicate entries, traversal paths and special symlink members',t=>{
  for(const entries of [
    [...basic,basic[0]],
    [...basic,{path:'../danger.txt',value:'evil'}],
    [...basic,{path:'lib/arm64-v8a/linked.so',value:'target',symlink:true}],
    [...basic,{path:'lib\\arm64-v8a\\wrong.so',value:'wrong'}],
  ])denied(fixture(t,{files:entries}),/unsafe ZIP member|linked or special ZIP entry/);
});
test('rejects unrecognized DEX/ELF locations and absent packaged native contents',t=>{
  for(const entries of [
    [...basic,{path:'assets/fake.so',value:'bad'}],
    [...basic,{path:'assets/classes3.dex',value:'bad'}],
    basic.filter(x=>!x.path.endsWith('.so')),
    basic.filter(x=>!x.path.endsWith('.dex')),
  ])denied(fixture(t,{files:entries}),/unrecognized packaged DEX\/ELF location|no packaged/);
});
test('rejects wrong Gradle-to-APK/commit binding and refuse rewriting evidence',t=>{
  denied(fixture(t,{gradleCommit:'f'.repeat(40)}),/Gradle inventory does not match/);
  const f=fixture(t);assert.equal(capture(f).status,0);
  assert.equal(capture(f).status,1);
  assert.match(capture(f).stderr,/refusing to overwrite/);
});
test('GitHub Action audits same downloaded APK without installing dependencies',()=>{
  const wf=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
  assert.match(wf,/lab\/p01-apk-packaged-binary-inventory-v1/);
  const prod=wf.slice(wf.indexOf('  assemble-combined-lab-apk:'),wf.indexOf('  reverify-downloaded-combined-apk:'));
  const verifier=wf.slice(wf.indexOf('  reverify-downloaded-combined-apk:'));
  assert.match(prod,/apk_packaged_binary_inventory\.py capture/);
  assert.match(prod,/apps\/mobile\/APK_PACKAGED_BINARY_INVENTORY\.json/);
  assert.match(verifier,/apk_packaged_binary_inventory\.py verify/);
  assert.ok(verifier.indexOf('apk_packaged_binary_inventory.py verify')<verifier.indexOf('verify_compiled_ota_runtime.py'));
  assert.doesNotMatch(verifier,/npm ci|npm install|gradlew|contents: write|secrets\.|gh release/);
});
