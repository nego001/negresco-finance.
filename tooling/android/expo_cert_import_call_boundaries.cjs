#!/usr/bin/env node
'use strict';
// Read-only, lexical co-location inventory. It never executes installed Expo code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {produce:baseline}=require('./expo_certificate_symbol_inventory.cjs');
const symbols=['validateSelfSignedCertificate','signBufferRSASHA256AndVerify',
 'generateDevelopmentCertificateFromCSR','generateCSR','generateKeyPair',
 'convertCertificatePEMToCertificate','convertCSRPEMToCSR'];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function block(m){throw Error('BLOCK: expo cert import/call boundary: '+m)}
function scan(dir){
 const st=fs.lstatSync(dir);if(!st.isDirectory()||st.isSymbolicLink())block('unsafe package');
 const summary=Object.fromEntries(symbols.map(s=>[s,{
  filesWithName:0,filesWithCallSyntax:0,filesWithMemberCall:0,
  filesWithSpecifierAndName:0,filesWithSpecifierAndCall:0,
  filesWithLiteralImportAndCall:0
 }]));
 const counts={sourceFiles:0,filesWithPackageSpecifier:0,filesWithLiteralImport:0};
 let bytes=0;
 function walk(folder,depth){
  if(depth>16)block('directory recursion exceeded');
  for(const e of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const p=path.join(folder,e.name);
   if(e.isSymbolicLink())block('source symlink');
   if(e.isDirectory()){if(e.name!=='node_modules'&&e.name!=='.git')walk(p,depth+1);continue}
   if(!e.isFile()||!/\.(?:js|cjs|mjs|ts|tsx)$/.test(e.name))continue;
   const size=fs.lstatSync(p).size;
   if(size<2||size>5*1024*1024)block('source file size');
   counts.sourceFiles++;bytes+=size;
   if(counts.sourceFiles>10000||bytes>90*1024*1024)block('scan volume');
   const data=fs.readFileSync(p).toString('utf8');
   const spec=/['"]@expo\/code-signing-certificates(?:\/[^'"]*)?['"]/.test(data);
   const literalImport=/\b(?:from\s*|require\s*\(\s*|import\s*\(\s*)['"]@expo\/code-signing-certificates(?:\/[^'"]*)?['"]/.test(data);
   if(spec)counts.filesWithPackageSpecifier++;
   if(literalImport)counts.filesWithLiteralImport++;
   for(const symbol of symbols){
    const mentions=new RegExp('\\b'+symbol+'\\b').test(data);
    const call=new RegExp('\\b'+symbol+'\\s*\\(').test(data);
    const member=new RegExp('\\.\\s*'+symbol+'\\s*\\(').test(data);
    const x=summary[symbol];
    if(mentions)x.filesWithName++;
    if(call)x.filesWithCallSyntax++;
    if(member)x.filesWithMemberCall++;
    if(spec&&mentions)x.filesWithSpecifierAndName++;
    if(spec&&call)x.filesWithSpecifierAndCall++;
    if(literalImport&&call)x.filesWithLiteralImportAndCall++;
   }
  }
 }
 walk(dir,0);if(!counts.sourceFiles)block('empty sources');
 return {counts,symbols:summary};
}
function produce(root,lock,commit){
 const parent=baseline(root,lock,commit);
 if(parent.approvedForProduction!==false||parent.stableReleaseAllowed!==false)
  block('parent report unexpectedly approved');
 const modules=path.resolve(root);if(path.basename(modules)!=='node_modules')block('invalid root');
 const packages=parent.packages.map(p=>{
  const dir=path.resolve(path.dirname(modules),p.lockLocation);
  if(!dir.startsWith(modules+path.sep))block('package escape');
  const data=scan(dir);
  if(data.counts.sourceFiles!==p.scannedSourceFiles)
   block('source count disagrees with pinned base');
  for(const [s,v] of Object.entries(data.symbols)){
   const prev=p.symbols[s];
   if(!prev||v.filesWithName!==prev.filesMentioning)
    block('source mention counts disagree with baseline for '+s);
  }
  return {package:p.package,version:p.version,lockLocation:p.lockLocation,
   sourceTreeSha256:p.sourceTreeSha256,...data};
 });
 return {schemaVersion:1,sourceCommit:commit,npmLockSha256:parent.npmLockSha256,
  baselineReportSha256:digest(Buffer.from(JSON.stringify(parent,null,2)+'\n')),
  approvedForProduction:false,stableReleaseAllowed:false,
  method:'TEXTUAL_IMPORT_AND_CALL_COOCCURRENCE_NOT_EXECUTABLE_CALL_GRAPH',
  warning:'Co-location may be comments, definitions or inactive code; zero signals never proves absence',
  packages};
}
function run(args){
 if(args.length!==5||!['capture','verify'].includes(args[0]))
  block('Usage: capture|verify NODE_MODULES LOCK COMMIT OUTPUT');
 const [mode,root,lock,commit,out]=args;
 const result=produce(root,lock,commit),data=Buffer.from(JSON.stringify(result,null,2)+'\n');
 if(mode==='capture'){
  if(fs.existsSync(out))block('refusing overwrite');
  fs.writeFileSync(out,data,{flag:'wx',mode:0o600});
  console.log('PASS (LAB): Expo certificate lexical boundaries saved, production blocked');
 }else{
  const stat=fs.lstatSync(out);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>3e6||
     !fs.readFileSync(out).equals(data))block('independent report mismatch');
  console.log('PASS (LAB): independent npm installation rederived lexical boundaries');
 }
 for(const p of result.packages){
  const s=p.symbols.validateSelfSignedCertificate;
  console.log('EXPO CERT BOUNDARY '+p.package+' files='+p.counts.sourceFiles+
   ' literalImportFiles='+p.counts.filesWithLiteralImport+
   ' validateCallFiles='+s.filesWithCallSyntax+
   ' sameImportAndCallFiles='+s.filesWithLiteralImportAndCall);
 }
}
if(require.main===module){try{run(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={scan,produce,run};
