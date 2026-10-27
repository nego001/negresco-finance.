#!/usr/bin/env node
'use strict';
// Lexical census only. NOT a crypto call graph, proof of execution, or security waiver.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {report:hostReport}=require('./forge_host_import_inventory.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const SHA=/^[0-9a-f]{40}$/;
function block(s){throw Error('BLOCK: host forge crypto API census: '+s);}
const patterns={
 pkiCertificateFromPem:/\b(?:forge\.)?(?:pki|PKI)\.certificateFromPem\s*\(/g,
 pkiCertificateToPem:/\b(?:forge\.)?(?:pki|PKI)\.certificateToPem\s*\(/g,
 pkiPrivateKeyFromPem:/\b(?:forge\.)?(?:pki|PKI)\.privateKeyFromPem\s*\(/g,
 pkiPublicKeyFromPem:/\b(?:forge\.)?(?:pki|PKI)\.publicKeyFromPem\s*\(/g,
 pkiCreateCertificate:/\b(?:forge\.)?(?:pki|PKI)\.createCertificate\s*\(/g,
 pkiCreateCertificationRequest:/\b(?:forge\.)?(?:pki|PKI)\.createCertificationRequest\s*\(/g,
 pkiRsaNamespace:/\b(?:forge\.)?(?:pki|PKI)\.rsa\b/g,
 sha256DigestFactory:/\b(?:forge\.)?md\.sha256\.create\s*\(/g,
 asn1FromDer:/\b(?:forge\.)?asn1\.fromDer\s*\(/g,
 asn1ToDer:/\b(?:forge\.)?asn1\.toDer\s*\(/g,
 genericVerifyMethodCall:/\.\s*verify\s*\(/g,
 genericSignMethodCall:/\.\s*sign\s*\(/g
};
const patternNames=Object.keys(patterns);
function countDir(dir){
 const s=fs.lstatSync(dir);if(!s.isDirectory()||s.isSymbolicLink())block('invalid installed package');
 let number=0,total=0;
 const digestLines=[],counts=Object.fromEntries(patternNames.map(k=>[k,0]));
 const filesWithSignal=new Set();
 function walk(current,depth){
  if(depth>15)block('source depth exceeded');
  for(const entry of fs.readdirSync(current,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const file=path.join(current,entry.name);
   if(entry.isSymbolicLink())block('symlink in package source');
   if(entry.isDirectory()){
    if(entry.name!=='node_modules'&&entry.name!=='.git')walk(file,depth+1);
   }else if(entry.isFile()&&/\.(?:js|mjs|cjs|ts|tsx)$/.test(entry.name)){
    const stat=fs.lstatSync(file);
    if(stat.size<2||stat.size>5*1024*1024)block('unexpected source file size');
    const bytes=fs.readFileSync(file);
    total+=bytes.length;number++;
    if(total>90*1024*1024||number>10000)block('package source exceeds limits');
    digestLines.push(path.relative(dir,file).replaceAll('\\','/')+'\0'+hash(bytes));
    const content=bytes.toString('utf8');
    for(const [key,pattern] of Object.entries(patterns)){
     const n=(content.match(pattern)||[]).length;
     counts[key]+=n;
     if(n)filesWithSignal.add(path.relative(dir,file));
    }
   }
  }
 }
 walk(dir,0);
 return {scannedSourceFiles:number,sourceTreeSha256:hash(Buffer.from(digestLines.join('\n'))),
  filesWithAnyApiToken:filesWithSignal.size,apiTokenCounts:counts};
}
function make(modules,lock,commit){
 if(!SHA.test(commit))block('invalid source commit');
 const host=hostReport(modules,lock,commit);
 if(host.approvedForProduction!==false||host.stableReleaseAllowed!==false||
    host.scannedPackages.length<5)block('underlying host import inventory not safe');
 const root=path.resolve(modules),pkgBase=path.dirname(root);
 const packages=host.scannedPackages.map(entry=>{
  const dir=path.resolve(pkgBase,entry.lockLocation);
  if(!dir.startsWith(root+path.sep))block('package path escapes node_modules');
  const scan=countDir(dir);
  if(scan.scannedSourceFiles!==entry.scannedSourceFiles||
     scan.sourceTreeSha256!==entry.sourceTreeSha256)
   block('crypto scan disagrees with exact host source tree');
  return {package:entry.package,lockLocation:entry.lockLocation,
   version:entry.version,...scan};
 });
 return {schemaVersion:1,approvedForProduction:false,stableReleaseAllowed:false,
  sourceCommit:commit,advisory:'GHSA-86w9-cpqp-85rv',
  method:'LEXICAL_FORGE_API_TOKENS_ON_INSTALLED_EXPO_HOST_NOT_EXECUTION',
  warning:'Generic sign/verify tokens may be unrelated; no dynamic execution, no call graph, no stable release',
  hostImportReportSha256:hash(Buffer.from(JSON.stringify(host,null,2)+'\n')),
  npmLockSha256:host.lockSha256,scannedPackages:packages};
}
function run(argv){
 if(argv.length!==5||!['capture','verify'].includes(argv[0]))
  block('Usage: capture|verify NODE_MODULES LOCK SOURCE_SHA REPORT');
 const [mode,modules,lock,commit,destination]=argv;
 const report=make(modules,lock,commit);
 const output=Buffer.from(JSON.stringify(report,null,2)+'\n');
 if(mode==='capture'){
  if(fs.existsSync(destination))block('refusing to overwrite result');
  fs.writeFileSync(destination,output,{flag:'wx',mode:0o600});
  console.log('PASS (LAB): pinned Expo host crypto API lexical census recorded; no signing performed');
 }else{
  const st=fs.lstatSync(destination);
  if(!st.isFile()||st.isSymbolicLink()||st.size>4*1024*1024||
     !fs.readFileSync(destination).equals(output))block('independent host crypto API census differed');
  console.log('PASS (LAB): independent npm ci exactly rederived crypto API census and source hashes');
 }
 for(const p of report.scannedPackages){
  const interesting=Object.entries(p.apiTokenCounts).filter(([,n])=>n>0).map(([k,n])=>k+':'+n).join(',');
  console.log('CRYPTO TOKENS '+p.package+' files='+p.scannedSourceFiles+
   ' signalFiles='+p.filesWithAnyApiToken+' tokens='+ (interesting||'none'));
 }
}
if(require.main===module){try{run(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={make,run,countDir,patterns};
