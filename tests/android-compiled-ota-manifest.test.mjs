import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const verifier=resolve('tooling/android/verify_compiled_ota_manifest.py');
const ANDROID='http://schemas.android.com/apk/res/android';
const PREFIX='expo.modules.updates.';
const PEM='-----BEGIN CERTIFICATE-----\nYQ==\n-----END CERTIFICATE-----\n';
const UPDATE={
  enabled:true,url:'https://u.expo.dev/example',
  codeSigningCertificate:'./certs/certificate.pem',
  codeSigningMetadata:{alg:'rsa-v1_5-sha256',keyid:'main'}
};
const N=0xffffffff;
const valid=[
  {name:PREFIX+'ENABLED',type:'bool',value:true},
  {name:PREFIX+'CODE_SIGNING_CERTIFICATE',type:'string',value:PEM},
  {name:PREFIX+'CODE_SIGNING_METADATA',type:'string',value:JSON.stringify(UPDATE.codeSigningMetadata)}
];

function len8(value){return value<128?Buffer.from([value]):Buffer.from([(value>>8)|0x80,value&255]);}
function node(type,name,ids,attrs=[]){
  if(type===0x0103){
    const buf=Buffer.alloc(24);
    buf.writeUInt16LE(type,0);buf.writeUInt16LE(16,2);buf.writeUInt32LE(24,4);
    buf.writeUInt32LE(N,12);buf.writeUInt32LE(N,16);
    buf.writeUInt32LE(ids.get(name),20);
    return buf;
  }
  const buf=Buffer.alloc(36+attrs.length*20);
  buf.writeUInt16LE(type,0);buf.writeUInt16LE(16,2);buf.writeUInt32LE(buf.length,4);
  buf.writeUInt32LE(N,12);buf.writeUInt32LE(N,16);
  buf.writeUInt32LE(ids.get(name),20);
  buf.writeUInt16LE(20,24);buf.writeUInt16LE(20,26);
  buf.writeUInt16LE(attrs.length,28);
  attrs.forEach((x,i)=>{
    const off=36+20*i;
    buf.writeUInt32LE(ids.get(ANDROID),off);
    buf.writeUInt32LE(ids.get(x.key),off+4);
    buf.writeUInt32LE(x.type==='string'?ids.get(x.value):N,off+8);
    buf.writeUInt16LE(8,off+12);
    buf.writeUInt8(x.type==='bool'?0x12:0x03,off+15);
    buf.writeUInt32LE(x.type==='bool'?(x.value?0xffffffff:0):ids.get(x.value),off+16);
  });
  return buf;
}
function makeAxml(records=valid,{nested=false,headerBroken=false,duplicateApp=false}={}){
  const values=['manifest','application','meta-data','activity',ANDROID,'name','value'];
  for(const record of records){values.push(record.name);if(record.type==='string')values.push(record.value);}
  const strings=[...new Set(values)];
  const ids=new Map(strings.map((v,i)=>[v,i]));
  const pieces=strings.map(x=>{
    const utf8=Buffer.from(x,'utf8');
    return Buffer.concat([len8(x.length),len8(utf8.length),utf8,Buffer.from([0])]);
  });
  const offsets=[];
  let total=0;
  for(const p of pieces){offsets.push(total);total+=p.length;}
  const stringsStart=28+strings.length*4;
  const pool=Buffer.alloc(stringsStart);
  pool.writeUInt16LE(1,0);pool.writeUInt16LE(28,2);
  pool.writeUInt32LE(stringsStart+total,4);
  pool.writeUInt32LE(strings.length,8);pool.writeUInt32LE(0x100,16);
  pool.writeUInt32LE(stringsStart,20);
  offsets.forEach((offset,i)=>pool.writeUInt32LE(offset,28+4*i));
  const chunks=[Buffer.concat([pool,...pieces])];
  const start=(n,a)=>chunks.push(node(0x0102,n,ids,a));
  const end=n=>chunks.push(node(0x0103,n,ids));
  start('manifest',[]);
  start('application',[]);
  for(const record of records){
    if(nested)start('activity',[]);
    const attrs=[
      {key:'name',type:'string',value:record.name},
      {key:'value',type:record.type,value:record.value}
    ];
    start('meta-data',attrs);end('meta-data');
    if(nested)end('activity');
  }
  end('application');
  if(duplicateApp){start('application',[]);end('application');}
  end('manifest');
  const body=Buffer.concat(chunks);
  const out=Buffer.alloc(8);
  out.writeUInt16LE(3,0);out.writeUInt16LE(8,2);out.writeUInt32LE(body.length+8,4);
  const axml=Buffer.concat([out,body]);
  if(headerBroken)axml.writeUInt32LE(axml.length+42,4);
  return axml;
}
function fixture(t,options={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-compiled-ota-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  mkdirSync(join(dir,'certs'));
  writeFileSync(join(dir,'certs','certificate.pem'),PEM);
  const config=join(dir,'app.json');
  writeFileSync(config,JSON.stringify({expo:{updates:options.updates??UPDATE}}));
  const bin=join(dir,'AndroidManifest.xml');
  writeFileSync(bin,options.binary??makeAxml(options.records??valid,options));
  const apk=join(dir,'test.apk');
  const py=[
    'import sys,zipfile,warnings',
    'warnings.simplefilter("ignore",UserWarning)',
    'with zipfile.ZipFile(sys.argv[1],"w") as archive:',
    ' archive.write(sys.argv[2],"AndroidManifest.xml")',
    ' if sys.argv[3]=="duplicate": archive.write(sys.argv[2],"AndroidManifest.xml")'
  ].join('\n');
  const out=spawnSync('python3',['-c',py,apk,bin,options.duplicateZip?'duplicate':'no'],{encoding:'utf8'});
  assert.equal(out.status,0,out.stderr);
  return {dir,config,apk};
}
function exec(f,mode='--verify-stable'){
  const args=[verifier,mode,f.apk];
  if(mode==='--verify-stable')args.push(f.config);
  return spawnSync('python3',args,{encoding:'utf8',timeout:10000});
}
function allow(f,mode='--verify-stable'){
  const r=exec(f,mode);assert.equal(r.status,0,r.stderr+r.stdout);
  assert.match(r.stdout,/PASS:/);
}
function deny(f,pattern,mode='--verify-stable'){
  const r=exec(f,mode);assert.equal(r.status,1,r.stderr+r.stdout);
  assert.match(r.stderr,pattern);
}
test('compiled binary OTA manifest accepts identical embedded PEM and pinned metadata',t=>{
  allow(fixture(t));
});
test('parse-only can read unsigned preview but never claims stable verification',t=>{
  const f=fixture(t,{records:[{name:PREFIX+'ENABLED',type:'bool',value:true}]});
  const r=exec(f,'--parse-only');
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/NOT a stable OTA security audit/);
  deny(f,/certificate or signature metadata is missing/);
});
test('compiled embedded-only manifest must carry typed disabled flag',t=>{
  allow(fixture(t,{updates:{enabled:false},records:[
    {name:PREFIX+'ENABLED',type:'bool',value:false}
  ]}));
});
test('compiled APK rejects embedded-only mode if enabled true',t=>{
  deny(fixture(t,{updates:{enabled:false}}),/embedded-only compiled APK must disable/);
});
test('compiled APK rejects an omitted enabled flag',t=>{
  deny(fixture(t,{records:valid.slice(1)}),/does not explicitly enable signed OTA/);
});
test('compiled APK rejects string "true" instead of typed true',t=>{
  deny(fixture(t,{records:[{name:PREFIX+'ENABLED',type:'string',value:'true'},...valid.slice(1)]}),
    /does not explicitly enable signed OTA/);
});
test('compiled APK rejects substituted certificate bytes',t=>{
  const records=valid.map(x=>x.name.endsWith('CODE_SIGNING_CERTIFICATE')?{...x,value:PEM+'malicious'}:x);
  deny(fixture(t,{records}),/public certificate differs/);
});
test('compiled APK rejects wrong keyid',t=>{
  const records=valid.map(x=>x.name.endsWith('CODE_SIGNING_METADATA')?
    {...x,value:JSON.stringify({alg:'rsa-v1_5-sha256',keyid:'other'})}:x);
  deny(fixture(t,{records}),/algorithm\/keyid differs/);
});
test('compiled APK rejects a malformed signing metadata JSON',t=>{
  const records=valid.map(x=>x.name.endsWith('CODE_SIGNING_METADATA')?{...x,value:'bad json'}:x);
  deny(fixture(t,{records}),/not JSON/);
});
test('compiled APK rejects duplicate signed metadata',t=>{
  deny(fixture(t,{records:[...valid,valid[1]]}),/duplicate application metadata/);
});
test('compiled APK rejects unknown signing override',t=>{
  deny(fixture(t,{records:[...valid,{name:PREFIX+'CODE_SIGNING_BYPASS',type:'bool',value:true}]}),
    /unexpected OTA signing metadata/);
});
test('compiled APK rejects signing metadata placed only in activity',t=>{
  deny(fixture(t,{nested:true}),/does not explicitly enable signed OTA/);
});
test('compiled APK rejects duplicate application elements',t=>{
  deny(fixture(t,{duplicateApp:true}),/exactly one closed manifest/,'--parse-only');
});
test('compiled APK rejects a corrupt binary XML size',t=>{
  deny(fixture(t,{headerBroken:true}),/not a complete Android compiled binary manifest/,'--parse-only');
});
test('compiled APK rejects duplicate ZIP manifest entries',t=>{
  deny(fixture(t,{duplicateZip:true}),/compiled AndroidManifest must be unique/,'--parse-only');
});
test('compiled APK rejects symlinked PEM despite valid compiled policy',t=>{
  const f=fixture(t);
  const p=join(f.dir,'certs','certificate.pem');
  const elsewhere=join(f.dir,'original.pem');
  writeFileSync(elsewhere,PEM);rmSync(p);symlinkSync(elsewhere,p);
  deny(f,/PEM certificate is symlinked/);
});
test('compiled APK rejects source/config disagreement about enabled OTA',t=>{
  deny(fixture(t,{updates:{...UPDATE,enabled:false}}),/embedded-only compiled APK must disable/);
});
test('native APK workflow orders compiled OTA inspection before uploads and only stable gate on main dispatch',()=>{
  const w=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
  const build=w.slice(w.indexOf('  build-test-apk:'),w.indexOf('  publish-test-prerelease:'));
  const parsed=build.indexOf('      - name: Parse compiled OTA metadata in laboratory APK');
  const gate=build.indexOf('      - name: Verify compiled OTA policy for stable APK');
  const upload=build.indexOf('      - name: Upload standalone APK');
  assert.ok(parsed>0&&gate>parsed&&upload>gate);
  assert.match(build,/verify_compiled_ota_manifest\.py --parse-only android\/app\/build\/outputs\/apk\/release\/app-release\.apk/);
  assert.match(build,/verify_compiled_ota_manifest\.py --verify-stable android\/app\/build\/outputs\/apk\/release\/app-release\.apk app\.json/);
  assert.match(build,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && \(inputs\.publish_release \|\| inputs\.stable_signing\)/);
  assert.match(w,/tooling\/android\/verify_compiled_ota_manifest\.py/);
  assert.match(w,/tests\/android-compiled-ota-manifest\.test\.mjs/);
});
