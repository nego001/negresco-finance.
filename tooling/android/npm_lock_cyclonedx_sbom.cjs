#!/usr/bin/env node
'use strict';
// Deterministic CycloneDX 1.6 npm dependency INVENTORY for the exact tested
// lockfile. Includes build/dev/transitive packages; NOT an APK runtime SBOM,
// vulnerability verdict, or cryptographically signed build attestation.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {parseUniqueJson}=require('./verify_stable_npm_lock.cjs');
const MAX_BYTES=8*1024*1024;
function block(msg){throw new Error('BLOCK: downloaded npm SBOM: '+msg);}
function read(file){
  const stat=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!stat||stat.isSymbolicLink()||!stat.isFile()||stat.size<2||stat.size>MAX_BYTES)
    block('missing, linked or oversized: '+path.basename(file));
  return fs.readFileSync(file);
}
function parseLock(bytes){
  let value;
  try{value=parseUniqueJson(bytes.toString('utf8'));}
  catch(e){block('invalid or duplicate-key lockfile JSON: '+e.message);}
  if(!value||value.lockfileVersion!==3||value.name!=='@negresco/mobile'||
     value.version!=='3.1.3'||!value.packages||typeof value.packages!=='object'||
     !value.packages['']||value.packages[''].name!==value.name||
     value.packages[''].version!==value.version)
    block('wrong npm v3 lockfile identity/root');
  return value;
}
function extractNpmName(key){
  if(!/^node_modules\/(?:@[^/]+\/)?[^/]+(?:\/node_modules\/(?:@[^/]+\/)?[^/]+)*$/.test(key)||
     key.split('/').some(part=>part==='.'||part==='..'))
    block('invalid npm lock package path: '+key);
  const suffix=key.split('node_modules/').at(-1);
  if(!/^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/.test(suffix))
    block('invalid final npm package name: '+key);
  return suffix;
}
function purl(name,version){
  const pieces=name.startsWith('@')?name.split('/').map(encodeURIComponent):[encodeURIComponent(name)];
  return 'pkg:npm/'+pieces.join('/')+'@'+encodeURIComponent(version);
}
const GRAPH_SECTIONS=['dependencies','optionalDependencies','devDependencies','peerDependencies'];
function resolveDependency(lock,from,name){
  if(!/^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/.test(name))
    block('invalid graph dependency name: '+name);
  let parent=from;
  while(parent){
    const candidate=parent+'/node_modules/'+name;
    if(Object.hasOwn(lock.packages,candidate))return candidate;
    const split=parent.lastIndexOf('/node_modules/');
    if(split<0)break;
    parent=parent.slice(0,split);
  }
  const top='node_modules/'+name;
  return Object.hasOwn(lock.packages,top)?top:null;
}
function dependencyGraph(lock){
  const locations=Object.keys(lock.packages).sort();
  const dependencies=[];
  const missingPeers=[];
  let resolvedEdges=0;
  const kinds={dependencies:0,optionalDependencies:0,devDependencies:0,peerDependencies:0};
  for(const location of locations){
    const entry=lock.packages[location];
    if(!entry||typeof entry!=='object'||Array.isArray(entry))
      block('invalid graph package at '+location);
    const targets=new Set();
    for(const section of GRAPH_SECTIONS){
      const declared=entry[section];
      if(declared===undefined)continue;
      if(!declared||typeof declared!=='object'||Array.isArray(declared))
        block('invalid '+section+' map at '+location);
      for(const [name,range] of Object.entries(declared).sort((a,b)=>a[0].localeCompare(b[0]))){
        if(typeof range!=='string'||!range.trim())block('invalid '+section+' range '+name);
        const locationOfTarget=resolveDependency(lock,location,name);
        if(!locationOfTarget){
          if(section!=='peerDependencies')
            block('unresolved non-peer '+section+' dependency '+name+' from '+(location||'root'));
          const meta=entry.peerDependenciesMeta?.[name];
          if(meta!==undefined&&(!meta||typeof meta!=='object'||Array.isArray(meta)||
             (meta.optional!==undefined&&typeof meta.optional!=='boolean')))
            block('invalid peerDependenciesMeta for '+name);
          missingPeers.push({
            from:location||'root',name,declared:range,
            optional:meta?.optional===true
          });
          continue;
        }
        targets.add('npm-lock:'+locationOfTarget);
        kinds[section]++;
        resolvedEdges++;
        if(resolvedEdges>50000)block('too many installed graph edges');
      }
    }
    dependencies.push({ref:location?'npm-lock:'+location:'npm-lock:root',
      dependsOn:[...targets].sort()});
  }
  if(missingPeers.length>1000)block('too many missing npm peer requirements');
  return {dependencies,missingPeers,kinds,resolvedEdges,
    distinctEdges:dependencies.reduce((n,x)=>n+x.dependsOn.length,0)};
}
function sbom(lockBytes){
  const lock=parseLock(lockBytes);
  const paths=Object.keys(lock.packages).filter(key=>key!=='').sort();
  if(paths.length<1||paths.length>15000)block('impossible npm package count');
  const components=paths.map(location=>{
    const data=lock.packages[location],name=extractNpmName(location);
    if(!data||data.link||data.inBundle||typeof data.version!=='string'||
       !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(data.version))
      block('unexpected npm lock package record: '+location);
    let resolved;
    try{resolved=new URL(data.resolved);}catch{block('unparseable package registry URL: '+location);}
    if(resolved.protocol!=='https:'||resolved.hostname!=='registry.npmjs.org'||
       resolved.username||resolved.password||resolved.port||resolved.hash||
       resolved.search||!resolved.pathname.startsWith('/'))
      block('unsafe registry URL: '+location);
    if(typeof data.integrity!=='string'||
       !/^sha512-[A-Za-z0-9+/]{86}==$/.test(data.integrity))
      block('package lacks pinned SHA-512 integrity: '+location);
    const digest=Buffer.from(data.integrity.slice(7),'base64');
    if(digest.length!==64||digest.toString('base64')!==data.integrity.slice(7))
      block('noncanonical npm integrity hash: '+location);
    const properties=[
      {name:'negresco:npm-lock-path',value:location},
      {name:'negresco:npm-development',value:String(data.dev===true)},
      {name:'negresco:npm-optional',value:String(data.optional===true)},
      {name:'negresco:npm-resolved',value:data.resolved}
    ];
    if(typeof data.license==='string'&&data.license.trim())
      properties.push({name:'negresco:npm-license-declared',value:data.license});
    return {
      type:'library', 'bom-ref':'npm-lock:'+location,
      name,version:data.version,purl:purl(name,data.version),
      hashes:[{alg:'SHA-512',content:digest.toString('hex')}],
      properties
    };
  });
  const graph=dependencyGraph(lock);
  return {
    bomFormat:'CycloneDX',specVersion:'1.6',version:1,
    metadata:{
      component:{type:'application','bom-ref':'npm-lock:root',name:'@negresco/mobile',
        version:'3.1.3',purl:purl('@negresco/mobile','3.1.3')},
      properties:[
        {name:'negresco:scope',value:'unreviewed-npm-build-graph-not-apk-runtime'},
        {name:'negresco:release-approved',value:'false'},
        {name:'negresco:source-lock-sha256',
         value:crypto.createHash('sha256').update(lockBytes).digest('hex')},
        {name:'negresco:resolved-graph-requirements',value:String(graph.resolvedEdges)},
        {name:'negresco:distinct-graph-edges',value:String(graph.distinctEdges)},
        {name:'negresco:unresolved-peer-count',value:String(graph.missingPeers.length)},
        {name:'negresco:unresolved-peers-json',value:JSON.stringify(graph.missingPeers)},
        {name:'negresco:graph-edge-kinds',value:JSON.stringify(graph.kinds)}
      ]
    },
    components,
    dependencies:graph.dependencies
  };
}
function serialized(lockfile){return Buffer.from(JSON.stringify(sbom(read(lockfile)),null,2)+'\n');}
function capture(lockfile,target){
  if(fs.existsSync(target))block('refuse to overwrite existing SBOM');
  const data=serialized(lockfile);
  fs.writeFileSync(target,data,{flag:'wx',mode:0o600});
  console.log('PASS (LAB): deterministic CycloneDX npm build-graph SBOM with '+
              JSON.parse(data).components.length+' components');
}
function verify(lockfile,reference){
  const expected=serialized(lockfile),actual=read(reference);
  if(!expected.equals(actual))
    block('downloaded SBOM differs from exact package-lock.json bytes');
  console.log('PASS (LAB): downloaded SBOM precisely matches '+JSON.parse(expected).components.length+
              ' dependency lock components and their SHA-512 integrity hashes');
}
function main(args){
  if(args.length!==3||!['capture','verify'].includes(args[0])){
    console.error('Usage: npm_lock_cyclonedx_sbom.cjs <capture|verify> <lockfile> <bom.json>');
    return 2;
  }
  try{args[0]==='capture'?capture(args[1],args[2]):verify(args[1],args[2]);return 0;}
  catch(e){console.error(e.message);return 1;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={sbom,serialized,capture,verify,extractNpmName,purl,resolveDependency,dependencyGraph};
