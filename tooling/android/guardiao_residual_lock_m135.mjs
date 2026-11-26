import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const TARGET='node_modules/expo/node_modules/minimatch';
const PARENT='node_modules/expo/node_modules/glob';
const DONOR='node_modules/minimatch';
const leaf=p=>p.slice(p.lastIndexOf('node_modules/')+13);
export function resolveLocked(packages,parent,name){
 let at=parent;
 while(true){
  const p=(at?at+'/':'')+'node_modules/'+name;
  if(Object.hasOwn(packages,p))return p;
  if(!at)return null;
  const i=at.lastIndexOf('/node_modules/');
  at=i<0?'':at.slice(0,i);
 }
}
export function repair(lock,semver){
 const p=lock.packages;
 assert.equal(p[TARGET]?.version,'9.0.9');
 assert.equal(p[DONOR]?.version,'11.0.9');
 assert.equal(p[PARENT]?.version,'14.0.2');
 assert.equal(p[PARENT]?.dependencies?.minimatch,'^11.0.0');
 assert.ok(!Object.keys(p).some(k=>k.startsWith(TARGET+'/')));
 const inbound=[];
 for(const [parent,e] of Object.entries(p)){
  for(const field of ['dependencies','optionalDependencies','peerDependencies','devDependencies']){
   const range=e[field]?.minimatch;
   if(typeof range==='string'&&resolveLocked(p,parent,'minimatch')===TARGET)inbound.push({parent,field,range});
  }
 }
 assert.deepEqual(inbound,[{parent:PARENT,field:'dependencies',range:'^11.0.0'}]);
 const next=structuredClone(lock);
 delete next.packages[TARGET];
 const q=next.packages;
 assert.equal(resolveLocked(q,PARENT,'minimatch'),DONOR);
 assert.ok(semver.satisfies(q[DONOR].version,inbound[0].range));
 for(const [name,range] of Object.entries(q[DONOR].dependencies??{})){
  const dep=resolveLocked(q,DONOR,name);assert.ok(dep&&semver.satisfies(q[dep].version,range));
 }
 for(const [parent,e] of Object.entries(p)){
  if(parent===TARGET)continue;
  for(const field of ['dependencies','optionalDependencies','peerDependencies','devDependencies']){
   for(const name of Object.keys(e[field]??{})){
    const before=resolveLocked(p,parent,name),after=resolveLocked(q,parent,name);
    if(before!==after)assert.ok(before===TARGET&&after===DONOR&&parent===PARENT&&name==='minimatch');
   }
  }
 }
 assert.equal(Object.keys(q).length,Object.keys(p).length-1);
 return next;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.equal(process.env.GITHUB_REF,'refs/heads/lab/p01-guardiao-residual-lock-m135-v1');
  assert.equal(process.argv.length,4);
  const path=process.argv[2],bytes=readFileSync(path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'e1ead757c2e5bb3cdb42974c7f5ab0c1d61051f253c1c35da551a3de0d32bf63');
  const repaired=repair(JSON.parse(bytes),createRequire(process.argv[3])('semver'));
  writeFileSync(path,JSON.stringify(repaired,null,2)+'\n');
  console.log('PASS (LAB): removed one incompatible shadowing record; exact existing fixed dependency now resolves');
 }catch(e){console.error('BLOCK (LAB): residual lock repair preconditions failed: '+e.message);process.exitCode=1}
}
