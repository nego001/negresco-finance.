#!/usr/bin/env node
'use strict';

// Offline admission gate for future stable builds. A reviewed npm lockfile
// is required, not generated dynamically during release compilation.
// This intentionally BLOCKS stable publishing while the repo has no lockfile.
const fs=require('node:fs');
const path=require('node:path');

const MAX_MANIFEST=64*1024;
const MAX_LOCK=8*1024*1024;
const REGISTRY='registry.npmjs.org';

function block(message){throw new Error('BLOCK: stable npm dependency policy: '+message);}
function plain(value){return value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;}
function parseUniqueJson(raw){
  // JSON.parse silently accepts duplicate keys. Reject them using an explicit
  // streaming scanner, including nested objects and escaped key spellings.
  // Validation here is defensive, not a substitute for npm ci's lock checks.
  const result=JSON.parse(raw);
  const state={i:0};
  const white=()=>{while(/\s/.test(raw[state.i]||'')&&state.i<raw.length)state.i++;};
  const parseString=()=>{
    const start=state.i;
    if(raw[state.i]!=='"')block('invalid JSON string');
    state.i++;
    for(;;){
      if(state.i>=raw.length)block('unterminated JSON string');
      const ch=raw[state.i++];
      if(ch==='"')break;
      if(ch==='\\'){
        if(state.i>=raw.length)block('invalid JSON escape');
        if(raw[state.i]==='u')state.i+=5;
        else state.i++;
      }
    }
    return JSON.parse(raw.slice(start,state.i));
  };
  const value=()=>{
    white();
    if(raw[state.i]==='{'){
      state.i++;white();const keys=new Set();
      if(raw[state.i]==='}') {state.i++;return;}
      for(;;){
        white();const key=parseString();white();
        if(keys.has(key))block('duplicate JSON key '+key);
        keys.add(key);
        if(raw[state.i++]!==':')block('invalid JSON property');
        value();white();
        const c=raw[state.i++];
        if(c==='}')break;
        if(c!==',')block('invalid JSON object delimiter');
      }
    }else if(raw[state.i]==='['){
      state.i++;white();if(raw[state.i]===']'){state.i++;return;}
      for(;;){value();white();const c=raw[state.i++];if(c===']')break;if(c!==',')block('invalid JSON array delimiter');}
    }else if(raw[state.i]==='"')parseString();
    else{
      while(state.i<raw.length&&!/[\s,\]}]/.test(raw[state.i]))state.i++;
    }
  };
  value();white();if(state.i!==raw.length)block('trailing JSON data');
  return result;
}
function readJson(file,max){
  if(!path.isAbsolute(file))file=path.resolve(file);
  const stat=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!stat||stat.isSymbolicLink()||!stat.isFile()||stat.size<2||stat.size>max)
    block('missing, linked, nonregular or oversized '+path.basename(file));
  try{return parseUniqueJson(fs.readFileSync(file,'utf8'));}
  catch(e){block('cannot parse '+path.basename(file)+': '+e.message);}
}
function deps(obj,label){
  if(obj===undefined)return {};
  if(!plain(obj))block('invalid '+label);
  const out={};
  for(const [name,v] of Object.entries(obj)){
    if(!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(name)||typeof v!=='string'||!v.trim())
      block('invalid dependency in '+label);
    out[name]=v;
  }
  return out;
}
function equalMap(a,b){const x=Object.keys(a).sort(),y=Object.keys(b).sort();return x.length===y.length&&x.every((k,i)=>k===y[i]&&a[k]===b[k]);}
function verify(packageFile,lockFile){
  const manifest=readJson(packageFile,MAX_MANIFEST);
  const lock=readJson(lockFile,MAX_LOCK);
  if(!plain(manifest)||!plain(lock)||typeof manifest.name!=='string'||manifest.private!==true||typeof manifest.version!=='string')
    block('invalid private package metadata');
  if(lock.lockfileVersion!==3||lock.name!==manifest.name||lock.version!==manifest.version||!plain(lock.packages))
    block('npm v3 lockfile or package identity mismatch');
  const entries=Object.entries(lock.packages);
  if(entries.length<2||entries.length>15000)block('missing or excessive npm lock packages');
  const root=lock.packages[''];
  if(!plain(root)||root.name!==manifest.name||root.version!==manifest.version)
    block('npm lock root identity mismatch');
  for(const field of ['dependencies','devDependencies','optionalDependencies']){
    if(!equalMap(deps(manifest[field],field),deps(root[field],'locked '+field)))
      block('npm lock root '+field+' differs from package.json');
  }
  if(!Object.keys(deps(manifest.dependencies,'dependencies')).length)
    block('stable mobile package has no production dependencies');
  for(const name of Object.keys({...deps(manifest.dependencies,'dependencies'),...deps(manifest.devDependencies,'devDependencies')})){
    if(!plain(lock.packages['node_modules/'+name]))
      block('missing direct dependency lock record: '+name);
  }
  let count=0;
  for(const [key,pkg] of entries){
    if(key==='')continue;
    if(!/^node_modules\/(?:@[^/]+\/)?[^/]+(?:\/node_modules\/(?:@[^/]+\/)?[^/]+)*$/.test(key)||
       key.split('/').some(part=>part==='.'||part==='..'))
      block('invalid lock package path');
    if(!plain(pkg)||pkg.link||pkg.inBundle||
       typeof pkg.version!=='string'||!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(pkg.version))
      block('unsafe lock package record: '+key);
    if(typeof pkg.resolved!=='string')block('package lacks resolved URL: '+key);
    let url;try{url=new URL(pkg.resolved);}catch{block('invalid npm resolved URL: '+key);}
    if(url.protocol!=='https:'||url.hostname!==REGISTRY||url.username||url.password||
       url.port||url.hash||!url.pathname.startsWith('/')||url.search)
      block('npm package resolution not pinned to trusted HTTPS registry: '+key);
    if(typeof pkg.integrity!=='string'||!/^sha512-[A-Za-z0-9+/]{86}==$/.test(pkg.integrity))
      block('missing SHA-512 integrity for npm package: '+key);
    count++;
  }
  return count;
}
function main(argv){
  if(argv.length!==2){
    console.error('Usage: node tooling/android/verify_stable_npm_lock.cjs apps/mobile/package.json apps/mobile/package-lock.json');
    return 2;
  }
  try{const count=verify(argv[0],argv[1]);console.log('PASS: stable mobile dependency lock v3 has '+count+' registry packages with SHA-512 integrity');return 0;}
  catch(e){console.error(e.message);return 1;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={verify,parseUniqueJson,main};
