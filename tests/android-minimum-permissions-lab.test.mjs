import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const app=JSON.parse(readFileSync('apps/mobile/app.json','utf8')).expo;
const workflow=readFileSync('.github/workflows/forge-141-minimum-android-permissions.yml','utf8');
const script='tooling/android/verify_compiled_minimum_permissions.py';
const block=['android.permission.SYSTEM_ALERT_WINDOW','android.permission.WRITE_EXTERNAL_STORAGE'];
test('permission removal is exclusively in this independent lab',()=>{
 assert.deepEqual(app.android.blockedPermissions,block);
 assert.match(workflow,/lab\/p01-android-minimum-permissions-v1/);
 assert.equal((workflow.match(/verify_compiled_minimum_permissions\.py/g)||[]).length,2);
 assert.match(workflow,/forge-141-android-minimum-permissions-unreviewed/);
 assert.match(workflow,/CN=Android Debug/);
 assert.doesNotMatch(workflow,/contents: write|gh release|eas update|expo publish/);
});
const U32=0xffffffff;
const textValue=s=>{
 const b=Buffer.from(s,'utf8');
 if(b.length>127||s.length>127)throw Error('fixture string oversized');
 return Buffer.concat([Buffer.from([s.length,b.length]),b,Buffer.from([0])]);
};
function stringPool(values){
 const buffers=values.map(textValue), n=values.length;
 const header=28, offsets=Buffer.alloc(4*n);
 let bytes=0;
 for(let i=0;i<n;i++){offsets.writeUInt32LE(bytes,i*4);bytes+=buffers[i].length;}
 const out=Buffer.alloc(header+offsets.length+bytes);
 out.writeUInt16LE(1,0);out.writeUInt16LE(header,2);out.writeUInt32LE(out.length,4);
 out.writeUInt32LE(n,8);out.writeUInt32LE(0,12);
 out.writeUInt32LE(0x100,16);out.writeUInt32LE(header+offsets.length,20);
 offsets.copy(out,header);Buffer.concat(buffers).copy(out,header+offsets.length);
 return out;
}
function start(idx,name,attrs=[]){
 const out=Buffer.alloc(36+20*attrs.length);
 out.writeUInt16LE(0x102,0);out.writeUInt16LE(16,2);out.writeUInt32LE(out.length,4);
 out.writeUInt32LE(U32,16);out.writeUInt32LE(idx(name),20);
 out.writeUInt16LE(20,24);out.writeUInt16LE(20,26);out.writeUInt16LE(attrs.length,28);
 attrs.forEach(([key,value],i)=>{
   const q=36+20*i;
   out.writeUInt32LE(idx('http://schemas.android.com/apk/res/android'),q);
   out.writeUInt32LE(idx(key),q+4);out.writeUInt32LE(U32,q+8);
   out.writeUInt16LE(8,q+12);out.writeUInt8(3,q+15);out.writeUInt32LE(idx(value),q+16);
 });
 return out;
}
function end(idx,name){
 const out=Buffer.alloc(24);
 out.writeUInt16LE(0x103,0);out.writeUInt16LE(16,2);out.writeUInt32LE(24,4);
 out.writeUInt32LE(U32,16);out.writeUInt32LE(idx(name),20);
 return out;
}
function axml(perms){
 const values=['manifest','application','uses-permission','name','http://schemas.android.com/apk/res/android',...perms];
 const idx=s=>values.indexOf(s);
 const entries=[start(idx,'manifest')];
 for(const p of perms)entries.push(start(idx,'uses-permission',[['name',p]]),end(idx,'uses-permission'));
 entries.push(start(idx,'application'),end(idx,'application'),end(idx,'manifest'));
 const chunks=[stringPool(values),...entries],size=8+chunks.reduce((n,x)=>n+x.length,0);
 const out=Buffer.alloc(size);out.writeUInt16LE(3,0);out.writeUInt16LE(8,2);out.writeUInt32LE(size,4);
 let pos=8;for(const c of chunks){c.copy(out,pos);pos+=c.length;}
 return out;
}
function fixture(t,perms){
 const dir=mkdtempSync(join(tmpdir(),'negresco-minperm-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const xml=join(dir,'manifest.xml'),padding=join(dir,'random.bin'),apk=join(dir,'test.apk');
 writeFileSync(xml,axml(perms));writeFileSync(padding,randomBytes(1536));
 const zip=spawnSync('python3',['-c',
  'import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_STORED) as z:\n z.write(sys.argv[2],"AndroidManifest.xml")\n z.write(sys.argv[3],"padding.bin")',
  apk,xml,padding],{encoding:'utf8'});
 assert.equal(zip.status,0,zip.stderr);
 return apk;
}
const execute=apk=>spawnSync('python3',[script,apk],{encoding:'utf8'});
test('compiled manifest accepts only needed permissions',t=>{
 const f=fixture(t,['android.permission.INTERNET','android.permission.USE_BIOMETRIC']);
 const p=execute(f);assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS \(LAB\)/);
});
for(const rejected of block){
 test('compiled manifest rejects '+rejected,t=>{
  const f=fixture(t,['android.permission.INTERNET','android.permission.USE_BIOMETRIC',rejected]);
  const p=execute(f);assert.notEqual(p.status,0);
  assert.match(p.stderr,/BLOCK.*forbidden compiled Android permissions/);
 });
}
test('compiled manifest fails closed when essential permission disappears',t=>{
 const f=fixture(t,['android.permission.INTERNET']);
 const p=execute(f);assert.notEqual(p.status,0);
 assert.match(p.stderr,/BLOCK.*required permissions unexpectedly lost/);
});
