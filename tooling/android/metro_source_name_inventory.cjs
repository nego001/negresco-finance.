#!/usr/bin/env node
'use strict';
// An independent Metro export observes SOURCE NAMES; not packaged-APK reachability.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const HASH=/^[0-9a-f]{64}$/;
const SHA=/^[0-9a-f]{40}$/;
const MAX_BYTES=96*1024*1024;
function fail(msg){throw Error('BLOCK: Metro JS inventory: '+msg);}
function read(file,max=MAX_BYTES){
 const st=fs.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>max)fail('unsafe evidence input');
 return fs.readFileSync(file);
}
function digest(b){return crypto.createHash('sha256').update(b).digest('hex');}
function json(file){try{return JSON.parse(read(file).toString('utf8'));}
 catch(e){fail('invalid JSON input: '+e.message);}}
const markers={
 nodeForge:'node_modules/node-forge/',
 expoCli:'node_modules/@expo/cli/',
 codeSigningCertificates:'node_modules/@expo/code-signing-certificates/',
 expoUpdates:'node_modules/expo-updates/'
};
function collect(directory){
 const st=fs.lstatSync(directory);
 if(!st.isDirectory()||st.isSymbolicLink())fail('unsafe export directory');
 const found=[];
 function visit(dir,depth){
  if(depth>8)fail('export path recursion exceeds limit');
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const file=path.join(dir,entry.name);
   if(entry.isSymbolicLink())fail('export contains symbolic link');
   if(entry.isDirectory())visit(file,depth+1);
   else if(entry.isFile() && entry.name.endsWith('.map'))found.push(file);
  }
 }
 visit(directory,0);
 if(found.length<1||found.length>40)fail('expected 1-40 companion Metro source maps');
 const sources=new Set(), mapHashes=[];
 for(const file of found){
  const bytes=read(file);
  let map;
  try{map=JSON.parse(bytes.toString('utf8'));}catch{fail('invalid source map JSON');}
  if(map.version!==3||!Array.isArray(map.sources)||map.sources.length<2)fail('malformed source map');
  if(!map.sources.every(s=>typeof s==='string'&&s.length>0&&s.length<4096))
   fail('unsafe source map names');
  for(const s of map.sources)sources.add(s.replaceAll('\\','/').replace(/^file:\/\//,''));
  mapHashes.push([path.relative(directory,file).replaceAll('\\','/'),digest(bytes)]);
 }
 const all=[...sources].sort();
 const counts={};
 for(const [key,prefix] of Object.entries(markers))
  counts[key]=all.filter(s=>s.includes(prefix)).length;
 const sourceNameSha256=digest(Buffer.from(all.join('\n'),'utf8'));
 const mapSetSha256=digest(Buffer.from(mapHashes.map(e=>e.join(':')).join('\n'),'utf8'));
 return {mapCount:found.length,sourceCount:all.length,
  sourceNameSha256,mapSetSha256,observedModuleSourceCounts:counts};
}
function produce(dir,lockfile,hermesfile,commit){
 if(!SHA.test(commit))fail('invalid Git commit SHA');
 const lockBytes=read(lockfile);
 let lock;try{lock=JSON.parse(lockBytes);}catch{fail('invalid npm lock');}
 const vulnerable=lock.packages?.['node_modules/node-forge'];
 if(lock.lockfileVersion!==3||!vulnerable||vulnerable.version!=='1.4.0'||
    !lock.packages?.['node_modules/@expo/code-signing-certificates'])
  fail('expected vulnerable npm graph changed; rerun security evaluation');
 const bytes=read(hermesfile,2*1024*1024);
 let hermes;try{hermes=JSON.parse(bytes);}catch{fail('invalid Hermes evidence');}
 if(hermes.schemaVersion!==1||hermes.approvedForProduction!==false||
    hermes.sourceCommit!==commit||!HASH.test(String(hermes.apkSha256))||
    !HASH.test(String(hermes.jsPayload?.sha256))||
    hermes.jsPayload.kind!=='hermes-bytecode'||
    !HASH.test(String(hermes.nativeBinaryInventorySha256)))
   fail('Hermes provenance and source commit not bound');
 return {
  schemaVersion:1,approvedForProduction:false,
  method:'SEPARATE_EXPO_EXPORT_SOURCE_MAP_NOT_PACKAGED_HERMES_MODULE_PROOF',
  conclusion:'Source-name comparison only; cannot prove native JS reachability or close GHSA-86w9-cpqp-85rv',
  sourceCommit:commit,apkSha256:hermes.apkSha256,
  packagedHermesSha256:hermes.jsPayload.sha256,
  packagedHermesEvidenceSha256:digest(bytes),
  npmLockSha256:digest(lockBytes),
  observedExport:collect(dir),
  advisory:{id:'GHSA-86w9-cpqp-85rv',nodeForgeLockedVersion:vulnerable.version,
    productionReleaseAllowed:false}
 };
}
function main(args){
 if(args.length!==6||args[0]!=='capture')fail('Usage: capture MAP-DIR LOCK HERMES-EVIDENCE SOURCE-COMMIT OUT');
 const [mode,dir,lock,hermes,commit,out]=args;
 const value=produce(dir,lock,hermes,commit);
 if(fs.existsSync(out))fail('refusing to overwrite source map evidence');
 fs.writeFileSync(out,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 console.log('PASS (LAB): companion Metro source-map names inventoried; NOT packaged Hermes reachability');
 for(const [k,v] of Object.entries(value.observedExport.observedModuleSourceCounts))
  console.log('OBSERVED '+k+': '+v);
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={collect,produce};
