import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const tool=resolve('tooling/android/verify_compiled_preview_ota.py');
const source=readFileSync(tool,'utf8');
const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
const job=workflow.slice(workflow.indexOf('  verify-downloaded-ota-runtime:'),workflow.indexOf('  publish-test-prerelease:'));
const name='      - name: Audit downloaded compiled Expo preview channel (read only)';
const step=job.slice(job.indexOf(name));
const match=/python3 - "\$APK" <<'PY'\r?\n([\s\S]*?)^          PY$/m.exec(step);
assert.ok(match,'a separate read-only step must inline the trusted Python script');
const embedded=match[1].split(/\r?\n/).map(line=>line.startsWith('          ')?line.slice(10):line).join('\n').trimEnd()+'\n';
const ANDROID='http://schemas.android.com/apk/res/android';
const PREFIX='expo.modules.updates.';
const ENDPOINT='https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95';
const N=0xffffffff;
const keys={
  enabled:PREFIX+'ENABLED',
  url:PREFIX+'EXPO_UPDATE_URL',
  headers:PREFIX+'UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
  cert:PREFIX+'CODE_SIGNING_CERTIFICATE',
  meta:PREFIX+'CODE_SIGNING_METADATA'
};
const valid=[
  {name:keys.enabled,type:'bool',value:true},
  {name:keys.url,type:'string',value:ENDPOINT},
  {name:keys.headers,type:'string',value:'{"expo-channel-name":"preview"}'}
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


function fixture(t,records=valid,options={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-preview-ota-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const xml=join(dir,'AndroidManifest.xml'),apk=join(dir,'test.apk');
  writeFileSync(xml,options.invalidXML??makeAxml(records,options));
  const program=[
    'import sys, zipfile, warnings',
    'warnings.filterwarnings("ignore", category=UserWarning)',
    'with zipfile.ZipFile(sys.argv[1],"w") as z:',
    ' z.write(sys.argv[2],"AndroidManifest.xml")',
    ' if sys.argv[3]=="duplicate": z.write(sys.argv[2],"AndroidManifest.xml")'
  ].join('\n');
  const p=spawnSync('python3',['-c',program,apk,xml,options.duplicateZip?'duplicate':'normal'],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  return apk;
}
function check(apk,inline=false){
  return spawnSync('python3',inline?['-',apk]:[tool,apk],{
    input:inline?embedded:undefined,encoding:'utf8',timeout:10000
  });
}
function allow(apk){
  for(const inline of [false,true]){
    const p=check(apk,inline);
    assert.equal(p.status,0,p.stderr+p.stdout);
    assert.match(p.stdout,/pinned to unsigned preview/);
  }
}
function deny(apk,pattern){
  for(const inline of [false,true]){
    const p=check(apk,inline);
    assert.notEqual(p.status,0,p.stderr+p.stdout);
    assert.match(p.stderr,pattern);
  }
}
const changed=(name,value,type='string')=>valid.map(x=>x.name===name?{name,type,value}:x);
const without=name=>valid.filter(x=>x.name!==name);

test('read-only preview auditor is exactly the version reviewed in source',()=>{
  assert.equal(embedded,source);
  assert.ok(job.indexOf(name)>job.indexOf('      - name: Reverify downloaded compiled OTA runtime (read only)'));
  assert.match(job,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(job,/actions\/checkout|contents: write|secrets\./);
  assert.match(workflow,/tests\/android-downloaded-preview-ota-isolation\.test\.mjs/);
  assert.match(workflow,/tooling\/android\/verify_compiled_preview_ota\.py/);
});
test('signed publisher remains isolated and never runs on pull requests',()=>{
  const pub=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
  assert.match(pub,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing/);
  assert.ok(workflow.indexOf(name)<workflow.indexOf('  publish-test-prerelease:'));
});
test('unsigned preview OTA endpoint and channel pass in the downloaded APK',t=>{
  allow(fixture(t));
});
test('preview cannot be redirected to another Expo endpoint',t=>{
  deny(fixture(t,changed(keys.url,'https://u.expo.dev/12345678-1234-1234-1234-123456789012')),/preview OTA endpoint changed/);
});
test('preview cannot silently use the production or staging channel',t=>{
  for(const channel of ['production','staging','dev']){
    deny(fixture(t,changed(keys.headers,JSON.stringify({'expo-channel-name':channel}))),/preview channel only/);
  }
});
test('preview cannot have a missing or additional header',t=>{
  for(const header of [{}, {'expo-channel-name':'preview',authorization:'Bearer abc'}]){
    deny(fixture(t,changed(keys.headers,JSON.stringify(header))),/preview channel only/);
  }
});
test('reject malformed or repeated JSON channel keys',t=>{
  for(const h of ['{bad json','{"expo-channel-name":"preview","expo-channel-name":"preview"}']){
    deny(fixture(t,changed(keys.headers,h)),/malformed compiled preview OTA channel headers|duplicate OTA request header keys/);
  }
});
test('reject channel passed as boolean or absent from binary manifest',t=>{
  deny(fixture(t,changed(keys.headers,true,'bool')),/short literal JSON string/);
  deny(fixture(t,without(keys.headers)),/short literal JSON string/);
});
test('reject OTA disabled or missing enabled boolean',t=>{
  deny(fixture(t,changed(keys.enabled,false,'bool')),/explicitly enabled updates/);
  deny(fixture(t,without(keys.enabled)),/explicitly enabled updates/);
});
test('reject OTA signing certificate injected into laboratory APK',t=>{
  deny(fixture(t,[...valid,{name:keys.cert,type:'string',value:'-----BEGIN CERTIFICATE-----'}]),/signing metadata/);
});
test('reject OTA signing metadata key ID injected into laboratory APK',t=>{
  deny(fixture(t,[...valid,{name:keys.meta,type:'string',value:'{"keyid":"bad"}'}]),/signing metadata/);
});
test('reject missing and duplicated OTA URL metadata',t=>{
  deny(fixture(t,without(keys.url)),/preview OTA endpoint changed/);
  deny(fixture(t,[...valid,valid[1]]),/duplicate application metadata/);
});
test('reject injected trailing/broken compiled XML',t=>{
  deny(fixture(t,valid,{headerBroken:true}),/not a complete Android compiled binary manifest/);
});
test('reject duplicate binary manifest members inside downloaded APK',t=>{
  deny(fixture(t,valid,{duplicateZip:true}),/compiled AndroidManifest must be unique/);
});
test('reject nested Expo metadata outside root application',t=>{
  deny(fixture(t,valid,{nested:true}),/explicitly enabled updates/);
});
