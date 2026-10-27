#!/usr/bin/env node
'use strict';
// Static reference census on exact installed Expo packages; no npm code is executed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {make:census}=require('./forge_host_crypto_api_census.cjs');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const symbols=['validateSelfSignedCertificate','signBufferRSASHA256AndVerify',
 'generateDevelopmentCertificateFromCSR','generateCSR','generateKeyPair',
 'convertCertificatePEMToCertificate','convertCSRPEMToCSR',
 'convertPublicKeyPEMToPublicKey','convertPrivateKeyPEMToPrivateKey'];
function fail(message){throw Error('BLOCK: installed Expo certificate symbols: '+message);}
function scan(dir){
 const st=fs.lstatSync(dir);if(!st.isDirectory()||st.isSymbolicLink())fail('unsafe package');
 const counts=Object.fromEntries(symbols.map(k=>[k,{mentions:0,callSyntax:0,memberCallSyntax:0,
   declarations:0,filesMentioning:0}]));
 const imports={expoCertificatePackage:0,nodeForge:0}, hashes=[];
 let files=0,size=0;
 function walk(where,depth){
  if(depth>16)fail('source tree too deep');
  for(const ent of fs.readdirSync(where,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const file=path.join(where,ent.name);
   if(ent.isSymbolicLink())fail('source symlink');
   if(ent.isDirectory()){if(ent.name!=='node_modules'&&ent.name!=='.git')walk(file,depth+1);continue;}
   if(!ent.isFile()||!/\.(?:js|cjs|mjs|ts|tsx)$/.test(ent.name))continue;
   const stat=fs.lstatSync(file);if(stat.size<2||stat.size>5*1024*1024)fail('unsafe source file');
   size+=stat.size;files++;if(size>90*1024*1024||files>10000)fail('scan limits exceeded');
   const buf=fs.readFileSync(file),s=buf.toString('utf8');
   hashes.push(path.relative(dir,file).replaceAll('\\','/')+'\0'+digest(buf));
   imports.expoCertificatePackage+=(s.match(/['"]@expo\/code-signing-certificates(?:\/[^'"]*)?['"]/g)||[]).length;
   imports.nodeForge+=(s.match(/['"]node-forge(?:\/[^'"]*)?['"]/g)||[]).length;
   for(const name of symbols){
    const rx=part=>new RegExp(part,'g'), c=counts[name];
    const mentions=(s.match(rx('\\b'+name+'\\b'))||[]).length;
    c.mentions+=mentions;
    c.callSyntax+=(s.match(rx('\\b'+name+'\\s*\\('))||[]).length;
    c.memberCallSyntax+=(s.match(rx('\\.\\s*'+name+'\\s*\\('))||[]).length;
    c.declarations+=(s.match(rx('\\b(?:async\\s+)?function\\s+'+name+'\\s*\\('))||[]).length;
    if(mentions)c.filesMentioning++;
   }
  }
 }
 walk(dir,0);if(!files)fail('empty package sources');
 return {scannedSourceFiles:files,sourceTreeSha256:digest(Buffer.from(hashes.join('\n'))),
  moduleSpecifierMentions:imports,symbols:counts};
}
function produce(modules,lock,commit){
 if(!/^[0-9a-f]{40}$/.test(commit))fail('invalid commit');
 const base=census(modules,lock,commit),root=path.resolve(modules);
 if(path.basename(root)!=='node_modules'||base.approvedForProduction!==false||
    base.stableReleaseAllowed!==false)fail('unsafe npm provenance');
 const packages=base.scannedPackages.map(p=>{
  const dir=path.resolve(path.dirname(root),p.lockLocation);
  if(!dir.startsWith(root+path.sep))fail('package escape');
  const x=scan(dir);
  if(x.scannedSourceFiles!==p.scannedSourceFiles||x.sourceTreeSha256!==p.sourceTreeSha256)
   fail('source does not match parent crypto census');
  return {package:p.package,version:p.version,lockLocation:p.lockLocation,...x};
 });
 return {schemaVersion:1,approvedForProduction:false,stableReleaseAllowed:false,
  sourceCommit:commit,npmLockSha256:base.npmLockSha256,
  previousCryptoCensusSha256:digest(Buffer.from(JSON.stringify(base,null,2)+'\n')),
  advisory:'GHSA-86w9-cpqp-85rv',
  method:'INSTALLED_EXPO_SYMBOL_COUNTS_NOT_STATIC_CALL_GRAPH_OR_RUNTIME_TRACE',
  limitation:'No input provenance, call graph, execution, RSA exponent or vulnerability fix established',
  packages};
}
function run(argv){
 if(argv.length!==5||!['capture','verify'].includes(argv[0]))
  fail('Usage: capture|verify NODE_MODULES LOCK COMMIT REPORT');
 const [mode,modules,lock,commit,output]=argv;
 const data=produce(modules,lock,commit),bytes=Buffer.from(JSON.stringify(data,null,2)+'\n');
 if(mode==='capture'){
  if(fs.existsSync(output))fail('refusing overwrite');
  fs.writeFileSync(output,bytes,{flag:'wx',mode:0o600});
  console.log('PASS (LAB): installed Expo certificate API names inventoried without executing code');
 }else{
  const st=fs.lstatSync(output);
  if(!st.isFile()||st.isSymbolicLink()||st.size>4*1024*1024||
     !fs.readFileSync(output).equals(bytes))
    fail('independent installation does not reproduce API symbol report');
  console.log('PASS (LAB): second npm ci rederived Expo certificate API symbol report byte-for-byte');
 }
 for(const p of data.packages)
  console.log('EXPO API SYMBOLS '+p.package+
    ' validateSelfSignedCertificate='+p.symbols.validateSelfSignedCertificate.mentions+
    ' signBufferRSASHA256AndVerify='+p.symbols.signBufferRSASHA256AndVerify.mentions+
    ' generateDevelopmentCertificateFromCSR='+p.symbols.generateDevelopmentCertificateFromCSR.mentions+
    ' certModuleSpecifiers='+p.moduleSpecifierMentions.expoCertificatePackage);
}
if(require.main===module){try{run(process.argv.slice(2));}
catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={scan,produce,run};
