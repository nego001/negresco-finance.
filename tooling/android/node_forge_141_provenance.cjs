#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const gitBlob=b=>crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function block(m){throw Error('BLOCK forge141: '+m)}
function raw(p){const s=fs.lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.size<2||s.size>8e6)block('invalid file');return fs.readFileSync(p)}
function report(pkgPath,lockPath,root,auditPath,commit){
 if(!/^[0-9a-f]{40}$/.test(commit))block('commit');
 const pkg=JSON.parse(raw(pkgPath)),lock=JSON.parse(raw(lockPath)),audit=JSON.parse(raw(auditPath));
 if(pkg.name!=='@negresco/mobile'||pkg.version!=='3.1.3'||lock.lockfileVersion!==3||
    lock.name!==pkg.name||lock.version!==pkg.version||
    JSON.stringify(pkg.overrides)!==JSON.stringify({postcss:'8.5.23','image-size':'2.0.3','node-forge':'1.4.1'}))block('candidate identity');
 const expected={'node_modules/expo':'54.0.38','node_modules/expo-updates':'29.0.20',
  'node_modules/expo/node_modules/@expo/cli':'54.0.28',
  'node_modules/@expo/code-signing-certificates':'0.0.6','node_modules/node-forge':'1.4.1'};
 for(const [p,v] of Object.entries(expected))if(lock.packages?.[p]?.version!==v)block('lock graph '+p);
 const forgePaths=Object.keys(lock.packages).filter(p=>p==='node_modules/node-forge'||p.endsWith('/node_modules/node-forge'));
 if(forgePaths.length!==1||forgePaths[0]!=='node_modules/node-forge')block('forge duplication');
 const f=lock.packages['node_modules/node-forge'];
 if(!f.integrity?.startsWith('sha512-')||
   f.resolved!=='https://registry.npmjs.org/node-forge/-/node-forge-1.4.1.tgz')block('registry integrity');
 const cli=lock.packages['node_modules/expo/node_modules/@expo/cli'].dependencies||{};
 const cert=lock.packages['node_modules/@expo/code-signing-certificates'].dependencies||{};
 if(!cli['node-forge']||!cli['@expo/code-signing-certificates']||!cert['node-forge']||
    !lock.packages['node_modules/expo-updates'].dependencies?.['@expo/code-signing-certificates'])
  block('npm graph routes');
 if(audit.metadata?.vulnerabilities?.total!==0||Object.keys(audit.vulnerabilities||{}).length!==0)
  block('advisories remain');
 if(path.basename(path.resolve(root))!=='node_modules')block('install root');
 const installed=JSON.parse(raw(path.join(root,'node-forge/package.json')));
 if(installed.name!=='node-forge'||installed.version!=='1.4.1')block('installed identity');
 const rsa=raw(path.join(root,'node-forge/lib/rsa.js'));
 if(gitBlob(rsa)!=='65f6e8469d8a7695f4438722577230136f9dd425')block('upstream rsa.js mismatch');
 const s=rsa.toString('utf8');
 for(const token of ['var withParameters = _encodeDigestInfo(oid, capture.digest, true);',
    '_encodeDigestInfo(oid, capture.digest, false);',
    'd.substring(0, withParameters.length) !== withParameters &&',
    'd.substring(0, withoutParameters.length) !== withoutParameters'])
  if(!s.includes(token))block('canonical DigestInfo guard missing');
 return {schemaVersion:1,sourceCommit:commit,productionApproved:false,stableReleaseAllowed:false,
  upstream:{tag:'v1.4.1',commit:'8a917370ec51731e817c2d547b7329a58f8210af',
   rsaGitBlob:'65f6e8469d8a7695f4438722577230136f9dd425'},
  npm:{version:'node-forge@1.4.1',integrity:f.integrity,auditTotal:0,
   candidatePackageSha256:sha(raw(pkgPath)),lockSha256:sha(raw(lockPath)),rsaSha256:sha(rsa)},
  caveat:'Static source equivalence and npm audit only; no APK, crypto exploit regression, or production approval'};
}
function run(args){
 if(args.length!==7||!['capture','verify'].includes(args[0]))
  block('usage capture|verify PACKAGE LOCK MODULES AUDIT COMMIT REPORT');
 const [mode,pkg,lock,mods,audit,commit,out]=args;
 const data=Buffer.from(JSON.stringify(report(pkg,lock,mods,audit,commit),null,2)+'\n');
 if(mode==='capture'){if(fs.existsSync(out))block('report exists');fs.writeFileSync(out,data,{flag:'wx',mode:0o600})}
 else if(!raw(out).equals(data))block('independent installed npm source differs');
 console.log('PASS LAB: Forge 1.4.1 installed RSA matches official Git blob; stable release BLOCKED');
}
if(require.main===module){try{run(process.argv.slice(2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={report,run,gitBlob};
