#!/usr/bin/env node
'use strict';
// Lexical RSA verification call-site triage. NEVER executes installed JS.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {make:cryptoCensus}=require('./forge_host_crypto_api_census.cjs');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const patterns=Object.freeze({
 publicKeyVerify:/\bpublicKey\s*(?:\?\.)?\.\s*verify\s*\(/g,
 certificateVerify:/\bcertificate\s*(?:\?\.)?\.\s*verify\s*\(/g,
 csrVerify:/\bcsr\s*(?:\?\.)?\.\s*verify\s*\(/g,
 privateKeySign:/\bprivateKey\s*(?:\?\.)?\.\s*sign\s*\(/g,
 certificateSign:/\bcertificate\s*(?:\?\.)?\.\s*sign\s*\(/g,
 genericVerify:/\.\s*verify\s*\(/g
});
function fail(msg){throw Error('BLOCK: forge RSA call-site triage: '+msg);}
function inspect(dir){
 const stats=fs.lstatSync(dir);
 if(!stats.isDirectory()||stats.isSymbolicLink())fail('invalid package dir');
 const totals=Object.fromEntries(Object.keys(patterns).map(k=>[k,0]));
 const sameFile={forgeImportAndPublicKeyVerify:0,forgeImportAndCertificateVerify:0};
 const candidateFiles=[];
 let sourceCount=0,bytesTotal=0;
 function walk(folder,depth){
  if(depth>16)fail('unexpected source recursion');
  for(const ent of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const loc=path.join(folder,ent.name);
   if(ent.isSymbolicLink())fail('symlink inside source tree');
   if(ent.isDirectory()){
    if(ent.name!=='node_modules'&&ent.name!=='.git')walk(loc,depth+1);
    continue;
   }
   if(!ent.isFile()||!/\.(?:js|mjs|cjs|ts|tsx)$/.test(ent.name))continue;
   const stat=fs.lstatSync(loc);
   if(stat.size<2||stat.size>5*1024*1024)fail('source file exceeds bounds');
   bytesTotal+=stat.size;sourceCount++;
   if(bytesTotal>90*1024*1024||sourceCount>10000)fail('package source too large');
   const buf=fs.readFileSync(loc),s=buf.toString('utf8'),per={};
   for(const [k,pattern] of Object.entries(patterns)){
    const n=(s.match(pattern)||[]).length;
    per[k]=n;totals[k]+=n;
   }
   const explicitForge=/\b(?:from|require\s*\(|import\s*\()\s*['"]node-forge(?:\/[^'"]+)?['"]/.test(s);
   if(explicitForge&&per.publicKeyVerify)sameFile.forgeImportAndPublicKeyVerify++;
   if(explicitForge&&per.certificateVerify)sameFile.forgeImportAndCertificateVerify++;
   if(per.publicKeyVerify||per.certificateVerify||per.csrVerify){
    // No raw source, file names, offsets, arguments, or PEM material leave runner.
    candidateFiles.push({
     opaqueFileIdSha256:digest(Buffer.from(path.relative(dir,loc).replaceAll('\\','/'))),
     fileContentSha256:digest(buf),
     explicitForgeLiteralImport:explicitForge,
     publicKeyVerify:per.publicKeyVerify,
     certificateVerify:per.certificateVerify,
     csrVerify:per.csrVerify
    });
   }
  }
 }
 walk(dir,0);
 if(!sourceCount)fail('empty package source tree');
 candidateFiles.sort((a,b)=>a.opaqueFileIdSha256.localeCompare(b.opaqueFileIdSha256));
 return {sourceCount,callsiteTokens:totals,sameFileIndicators:sameFile,candidateFiles};
}
function produce(modules,lock,commit){
 const census=cryptoCensus(modules,lock,commit);
 const root=path.resolve(modules);
 if(path.basename(root)!=='node_modules'||census.approvedForProduction!==false||
    census.stableReleaseAllowed!==false)fail('unreviewed npm graph identity');
 const results=census.scannedPackages.map(p=>{
  const dir=path.resolve(path.dirname(root),p.lockLocation);
  if(!dir.startsWith(root+path.sep))fail('package dir escapes node_modules');
  const observed=inspect(dir);
  if(observed.sourceCount!==p.scannedSourceFiles)
    fail('package source count conflicts with prior crypto census');
  return {package:p.package,lockLocation:p.lockLocation,version:p.version,
   sourceTreeSha256:p.sourceTreeSha256,...observed};
 });
 return {schemaVersion:1,approvedForProduction:false,stableReleaseAllowed:false,
  classification:'LEXICAL_RSA_VERIFY_CALLSITE_CANDIDATES_NOT_EXECUTED',
  sourceCommit:commit,npmLockSha256:census.npmLockSha256,
  parentCryptoCensusSha256:digest(Buffer.from(JSON.stringify(census,null,2)+'\n')),
  advisory:'GHSA-86w9-cpqp-85rv',affectedFunction:'node-forge RSA PKCS#1 v1.5 publicKey.verify DigestInfo',
  caution:'Candidates only: aliases, comments, control-flow and PKCS#1 mode unverified',
  packages:results};
}
function run(args){
 if(args.length!==5||!['capture','verify'].includes(args[0]))
  fail('Usage: capture|verify NODE_MODULES LOCK COMMIT REPORT');
 const [mode,modules,lock,commit,out]=args;
 const report=produce(modules,lock,commit);
 const data=Buffer.from(JSON.stringify(report,null,2)+'\n');
 if(mode==='capture'){
  if(fs.existsSync(out))fail('refusing to overwrite report');
  fs.writeFileSync(out,data,{flag:'wx',mode:0o600});
  console.log('PASS (LAB): direct RSA verify call-site CANDIDATES collected; no crypto operation executed');
 } else{
  const stat=fs.lstatSync(out);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4*1024*1024||
     !fs.readFileSync(out).equals(data))
   fail('independent reinstallation did not reproduce call-site report');
  console.log('PASS (LAB): independently rederived exact RSA call-site report from installed source');
 }
 for(const p of report.packages)
  console.log('RSA CALLS '+p.package+
    ' publicKey.verify='+p.callsiteTokens.publicKeyVerify+
    ' certificate.verify='+p.callsiteTokens.certificateVerify+
    ' csr.verify='+p.callsiteTokens.csrVerify+
    ' candidateFiles='+p.candidateFiles.length);
}
if(require.main===module){try{run(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={inspect,produce,run};
