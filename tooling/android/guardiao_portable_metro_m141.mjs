import {readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,join,relative,isAbsolute,sep} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {transform} from './guardiao_metro_moderate_adapter_m137.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
export const original='bb3f83881e8f3d765c8b9c1bf1de0e4f6ae5143e7eebf6f58a1df52fa6e793ec';
export const patched='3ea2b5f6792077da751938c13dbec55440c88b1fac9dde679df56f6e1683e7c0';
export function contained(root,file){const r=relative(root,file);return !!r&&!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep)}
export function state(hash){if(hash===original)return 'original';if(hash===patched)return 'patched';throw Error('unknown Metro bytes')}
export function plan(source,mode){
 const s=state(digest(source));
 if(mode==='verify'){assert.equal(s,'patched');return {changed:false,source}}
 assert.equal(mode,'apply');
 if(s==='patched')return {changed:false,source};
 const next=Buffer.from(transform(source.toString('utf8')),'utf8');
 assert.equal(digest(next),patched);
 return {changed:true,source:next};
}
function regular(p){assert.ok(lstatSync(p).isFile());assert.equal(realpathSync(p),resolve(p));return p}
export function run(root,mode){
 assert.equal(realpathSync(root),resolve(root));
 const manifest=regular(join(root,'package.json')),lock=regular(join(root,'package-lock.json'));
 assert.equal(digest(readFileSync(manifest)),'61bf3916e30b74d248040f236fcb1e9a36e484aadb2331a461509c206849becd');
 assert.equal(digest(readFileSync(lock)),'f66d6fd261dea4c82332bf0499058a039774da9dcaa77a6e3c30934e702a7c28');
 const modules=join(root,'node_modules');assert.equal(realpathSync(modules),resolve(modules));
 const req=createRequire(manifest),metro=regular(req.resolve('metro/package.json'));
 assert.ok(contained(modules,metro));assert.equal(JSON.parse(readFileSync(metro,'utf8')).version,'0.83.3');
 const mr=createRequire(metro),imageEntry=regular(mr.resolve('image-size'));
 assert.ok(contained(modules,imageEntry));
 const image=regular(join(resolve(dirname(imageEntry),'../..'),'package.json'));
 assert.ok(contained(modules,image));assert.equal(JSON.parse(readFileSync(image,'utf8')).version,'2.0.3');
 const file=regular(join(dirname(metro),'src','Assets.js'));
 assert.ok(contained(modules,file));
 const result=plan(readFileSync(file),mode);
 if(result.changed)writeFileSync(file,result.source);
 assert.equal(digest(readFileSync(file)),patched);
 return {changed:result.changed,sha256:patched,approvedForProduction:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  assert.equal(process.argv.length,3);
  assert.ok(['apply','verify'].includes(process.argv[2]));
  console.log(JSON.stringify(run(process.cwd(),process.argv[2])));
 }catch(e){console.error('BLOCK: exact candidate or Metro adapter verification failed: '+e.message);process.exitCode=1}
}
