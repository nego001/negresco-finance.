#!/usr/bin/env node
'use strict';

// Derive the npm install dependency paths that introduce node-forge.
// IMPORTANT: this is NOT proof the browser/Android runtime executes node-forge.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {parseUniqueJson}=require('./verify_stable_npm_lock.cjs');
const {sbom}=require('./npm_lock_cyclonedx_sbom.cjs');

const MAX_BYTES=8*1024*1024, TARGET='node_modules/node-forge';
function block(msg){throw new Error('BLOCK: node-forge reachability: '+msg);}
function fileBytes(file){
  const stat=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!stat||stat.isSymbolicLink()||!stat.isFile()||stat.size<2||stat.size>MAX_BYTES)
    block('missing, linked or oversized '+path.basename(file));
  return fs.readFileSync(file);
}
function parse(bytes,kind){
  try{return parseUniqueJson(bytes.toString('utf8'));}
  catch(e){block('invalid or duplicate-key '+kind+': '+e.message);}
}
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function resolve(lock,from,name){
  if(!/^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/.test(name))block('invalid dependency name '+name);
  let curr=from;
  while(curr){
    const candidate=curr+'/node_modules/'+name;
    if(Object.hasOwn(lock.packages,candidate))return candidate;
    const idx=curr.lastIndexOf('/node_modules/');
    if(idx===-1)break;
    curr=curr.slice(0,idx);
  }
  const root='node_modules/'+name;
  return Object.hasOwn(lock.packages,root)?root:null;
}
function make(lockBytes,bomBytes,ledgerBytes){
  const lock=parse(lockBytes,'npm lock'),bom=parse(bomBytes,'SBOM'),ledger=parse(ledgerBytes,'npm ledger');
  if(lock.lockfileVersion!==3||lock.name!=='@negresco/mobile'||lock.version!=='3.1.3'||
     !plain(lock.packages)||!plain(lock.packages['']))
    block('not expected npm v3 application graph');
  if(JSON.stringify(sbom(lockBytes))!==JSON.stringify(bom))
    block('SBOM differs from lockfile');
  if(ledger.productionApproved!==false||ledger.counts?.high!==5||ledger.counts?.total!==5||
     ledger.hashes?.lockSha256!==digest(lockBytes)||
     ledger.hashes?.sbomSha256!==digest(bomBytes)||
     !Array.isArray(ledger.vulnerabilities))
    block('advisory ledger differs from inputs');
  const expected=['@expo/cli','@expo/code-signing-certificates','expo','expo-updates','node-forge'].sort();
  if(JSON.stringify(ledger.vulnerabilities.map(v=>v.name).sort())!==JSON.stringify(expected))
    block('expected five unsuppressed npm advisory components');
  if(lock.packages[TARGET]?.version!=='1.4.0'||
     !ledger.vulnerabilities.some(v=>v.name==='node-forge'&&
       v.lockedVersions?.some(n=>n.location===TARGET&&n.version==='1.4.0')))
    block('root advisory version/path mismatch');
  const root=lock.packages[''];
  if(!plain(root.dependencies)||!root.dependencies.expo||!root.dependencies['expo-updates'])
    block('missing expected root Expo direct dependency chain');
  const paths=[],visited=new Set();
  function walk(current,steps,seen){
    if(steps.length>16)block('unbounded npm dependency path');
    if(current===TARGET){
      paths.push({entry:steps[0]?.dependency,
        nodes:steps.map(e=>({location:e.to,version:lock.packages[e.to].version})),
        edges:steps});
      if(paths.length>32)block('too many node-forge roots to review');
      return;
    }
    const node=lock.packages[current];
    if(!plain(node)||!plain(node.dependencies))return;
    for(const name of Object.keys(node.dependencies).sort()){
      const destination=resolve(lock,current,name);
      if(!destination){
        if(['expo','expo-updates','@expo/cli','@expo/code-signing-certificates','node-forge'].includes(name))
          block('missing protected dependency '+name+' required by '+current);
        continue;
      }
      if(seen.has(destination))continue;
      if(destination===TARGET||name==='expo'||name==='expo-updates'||
         name==='@expo/cli'||name==='@expo/code-signing-certificates'){
        if(!plain(lock.packages[destination])||typeof lock.packages[destination].version!=='string')
          block('malformed locked dependency '+destination);
        walk(destination,[...steps,{from:current,to:destination,dependency:name,
          declared:node.dependencies[name]}],new Set([...seen,destination]));
      }
    }
  }
  walk('',[],new Set(['']));
  paths.sort((a,b)=>JSON.stringify(a.edges).localeCompare(JSON.stringify(b.edges)));
  const expectedRoutes=[
    'expo>@expo/cli>@expo/code-signing-certificates>node-forge',
    'expo>@expo/cli>node-forge',
    'expo-updates>@expo/code-signing-certificates>node-forge'
  ];
  const routes=paths.map(p=>p.edges.map(e=>e.dependency).join('>')).sort();
  if(JSON.stringify(routes)!==JSON.stringify(expectedRoutes.sort()))
    block('node-forge dependency routes changed: '+JSON.stringify(routes));
  for(const p of paths){
    if(!['expo','expo-updates'].includes(p.entry)||
       p.edges[0].from!==''||
       p.edges.some((edge,i)=>edge.from!==(i===0?'':p.edges[i-1].to)||
         !plain(lock.packages[edge.to])))
      block('invalid root-to-node-forge graph path');
  }
  return {
    schemaVersion:1,
    status:'UNREVIEWED LAB / FIVE HIGH ADVISORIES / NO STABLE RELEASE',
    productionApproved:false,
    scope:'npm lockfile install graph; NOT Android runtime execution reachability',
    sha256:{lock:digest(lockBytes),sbom:digest(bomBytes),ledger:digest(ledgerBytes)},
    target:{location:TARGET,version:'1.4.0',advisory:'GHSA-86w9-cpqp-85rv'},
    paths
  };
}
function normalized(lock,bom,ledger){
  return Buffer.from(JSON.stringify(make(fileBytes(lock),fileBytes(bom),fileBytes(ledger)),null,2)+'\n');
}
function capture(lock,bom,ledger,output){
  if(fs.existsSync(output))block('refusing to overwrite dependency path report');
  const buffer=normalized(lock,bom,ledger);
  fs.writeFileSync(output,buffer,{flag:'wx',mode:0o600});
  console.log('PASS (LAB): verified three independent npm install routes to unpatched node-forge');
}
function verify(lock,bom,ledger,output){
  if(!normalized(lock,bom,ledger).equals(fileBytes(output)))
    block('downloaded node-forge dependency paths differ from actual lock and ledger');
  console.log('PASS (LAB): downloaded node-forge npm paths match lock, SBOM and advisory ledger exactly');
}
function main(args){
  if(args.length!==5||!['capture','verify'].includes(args[0])){
    console.error('Usage: verify_node_forge_dependency_paths.cjs <capture|verify> <lock> <sbom> <ledger> <output>');
    return 2;
  }
  try{
    const [mode,...rest]=args;
    mode==='capture'?capture(...rest):verify(...rest);
    return 0;
  }catch(e){console.error(e.message);return 1;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={make,resolve,capture,verify};
