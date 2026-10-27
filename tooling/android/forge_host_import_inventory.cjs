#!/usr/bin/env node
'use strict';
// Read-only lexical imports from the EXACT npm ci installation used by the lab.
// This is NOT a call graph and does not establish exploitability or safety.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const SHA=/^[a-f0-9]{40}$/;
const versions={'expo':'54.0.38','expo-updates':'29.0.20',
 '@expo/cli':'54.0.28','@expo/code-signing-certificates':'0.0.6',
 'node-forge':'1.4.0'};
function block(s){throw Error('BLOCK: host node-forge static inventory: '+s);}
function bytes(file,max=32*1024*1024){
 let st;try{st=fs.lstatSync(file);}catch{block('missing input');}
 if(st.isSymbolicLink()||!st.isFile()||st.size<2||st.size>max)block('unsafe input');
 return fs.readFileSync(file);
}
function json(b){try{return JSON.parse(b.toString('utf8'));}catch{block('invalid JSON');}}
function files(dir){
 let st;try{st=fs.lstatSync(dir);}catch{block('missing installed package directory');}
 if(!st.isDirectory()||st.isSymbolicLink())block('unsafe package directory');
 const found=[];
 let total=0;
 function walk(p,depth){
  if(depth>15)block('source tree too deep');
  for(const entry of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const full=path.join(p,entry.name);
   if(entry.isSymbolicLink())block('symlink inside audited package');
   if(entry.isDirectory()){
    if(entry.name!=='node_modules'&&entry.name!=='.git')walk(full,depth+1);
   } else if(entry.isFile()&&/\.(?:js|mjs|cjs|ts|tsx)$/.test(entry.name)){
    const data=bytes(full,5*1024*1024);
    total+=data.length;
    if(total>90*1024*1024||found.length>=10000)block('package source scan limit');
    found.push({relative:path.relative(dir,full).replaceAll('\\','/'),data});
   }
  }
 }
 walk(dir,0);
 if(!found.length)block('package contains no JavaScript sources');
 return found;
}
function scan(dir){
 const entries=files(dir);
 const imports=[/\brequire(?:\.resolve)?\s*\(\s*['"]node-forge(?:\/[^'"]+)?['"]/g,
  /\bfrom\s*['"]node-forge(?:\/[^'"]+)?['"]/g,
  /\bimport\s*\(\s*['"]node-forge(?:\/[^'"]+)?['"]/g,
  /\bimport\s*['"]node-forge(?:\/[^'"]+)?['"]/g];
 let references=0,importStatements=0,mentionFiles=0,importFiles=0;
 const digests=[];
 for(const {relative,data} of entries){
  const text=data.toString('utf8');
  const mentions=(text.match(/node-forge/g)||[]).length;
  let direct=0;
  for(const rx of imports)direct+=(text.match(rx)||[]).length;
  references+=mentions;importStatements+=direct;
  if(mentions)mentionFiles++;
  if(direct)importFiles++;
  digests.push(relative+'\0'+sha(data));
 }
 return {scannedSourceFiles:entries.length,sourceTreeSha256:sha(Buffer.from(digests.join('\n'))),
  literalNodeForgeMentions:references,filesWithMentions:mentionFiles,
  lexicalLiteralImports:importStatements,filesWithLiteralImports:importFiles};
}
function report(installed,lockfile,commit){
 if(!SHA.test(commit))block('source SHA invalid');
 const lb=bytes(lockfile),lock=json(lb);
 if(lock.lockfileVersion!==3||lock.name!=='@negresco/mobile'||lock.version!=='3.1.3'||
    !lock.packages||typeof lock.packages!=='object')
  block('unexpected candidate npm lock');
 const root=path.resolve(installed);
 if(path.basename(root)!=='node_modules')block('expected node_modules root');
 const matches=[];
 const seen=new Set();
 for(const [loc,entry] of Object.entries(lock.packages)){
  const found=loc.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/);
  if(!found||!Object.hasOwn(versions,found[1]))continue;
  const name=found[1];
  if(entry.version!==versions[name])block('vulnerable dependency version changed: '+name);
  if(!/^node_modules\/(?:[@\w./-]+)$/.test(loc)||loc.includes('..'))
   block('invalid package location');
  const packageDir=path.resolve(path.dirname(root),loc);
  if(!packageDir.startsWith(root+path.sep))block('package escapes node_modules');
  const metadata=json(bytes(path.join(packageDir,'package.json'),256*1024));
  if(metadata.name!==name||metadata.version!==entry.version)
   block('installed package does not match lock: '+name);
  matches.push({package:name,lockLocation:loc,version:entry.version,...scan(packageDir)});
  seen.add(name);
 }
 for(const name of Object.keys(versions))if(!seen.has(name))
  block('missing exact installed package: '+name);
 matches.sort((a,b)=>a.lockLocation.localeCompare(b.lockLocation));
 return {schemaVersion:1,approvedForProduction:false,stableReleaseAllowed:false,
  scope:'LEXICAL_INSTALLED_HOST_PACKAGE_SCAN_NOT_EXECUTABLE_REACHABILITY',
  sourceCommit:commit,lockSha256:sha(lb),
  advisory:'GHSA-86w9-cpqp-85rv',targetVersion:'node-forge@1.4.0',
  warning:'Lexical matches may be dead code or comments; dynamic imports/call paths are not proven or excluded',
  scannedPackages:matches};
}
function canonical(r){return Buffer.from(JSON.stringify(r,null,2)+'\n');}
function execute(argv){
 if(argv.length!==5||!['capture','verify'].includes(argv[0]))
  block('Usage: capture|verify NODE_MODULES LOCK SOURCE_SHA REPORT');
 const [mode,root,lock,commit,out]=argv;
 const buf=canonical(report(root,lock,commit));
 if(mode==='capture'){
  if(fs.existsSync(out))block('refusing to overwrite inventory');
  fs.writeFileSync(out,buf,{flag:'wx',mode:0o600});
  console.log('PASS (LAB): literal host imports inventoried from exact installed npm graph, release blocked');
 }else{
  if(!bytes(out,4*1024*1024).equals(buf))block('downloaded host package report disagrees with fresh npm ci');
  console.log('PASS (LAB): independent npm ci rederived every package count and source tree SHA');
 }
 const data=JSON.parse(buf);
 for(const p of data.scannedPackages)console.log('HOST OBSERVED '+p.package+' '+p.lockLocation+
  ' files='+p.scannedSourceFiles+' literalImports='+p.lexicalLiteralImports+
  ' mentions='+p.literalNodeForgeMentions);
}
if(require.main===module)try{execute(process.argv.slice(2));}
catch(e){console.error(e.message);process.exitCode=1;}
module.exports={report,scan,execute};
