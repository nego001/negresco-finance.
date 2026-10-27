#!/usr/bin/env node
'use strict';
// Reproducible bytes-only supply-chain validation. No package scripts/crypto run.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const COMMIT='8a917370ec51731e817c2d547b7329a58f8210af';
const TARGET='node_modules/node-forge';
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const sha512=b=>crypto.createHash('sha512').update(b).digest('base64');
function block(m){throw Error('BLOCK: forge 1.4.1 supply-chain lab: '+m)}
function read(f,max=8*1024*1024){
 let stat;try{stat=fs.lstatSync(f)}catch{block('missing evidence '+path.basename(f))}
 if(stat.isSymbolicLink()||!stat.isFile()||stat.size<2||stat.size>max)
  block('unsafe evidence '+path.basename(f));
 return fs.readFileSync(f);
}
function json(b){try{return JSON.parse(b.toString('utf8'))}catch{block('invalid JSON evidence')}}
function make(lockPath,packPath,installedRsa,upstreamRsa,installedPackage,auditPath,sha){
 if(!/^[0-9a-f]{40}$/.test(sha))block('source SHA');
 const lockBytes=read(lockPath),lock=json(lockBytes);
 if(lock.lockfileVersion!==3||lock.name!=='@negresco/mobile'||lock.version!=='3.1.3')
  block('unexpected app lock');
 const pk=lock.packages||{},forge=pk[TARGET],cli=pk['node_modules/expo/node_modules/@expo/cli'];
 const cert=pk['node_modules/@expo/code-signing-certificates'];
 const updates=pk['node_modules/expo-updates'];
 if(forge?.version!=='1.4.1'||cli?.version!=='54.0.28'||
    cert?.version!=='0.0.6'||updates?.version!=='29.0.20'||
    cli.dependencies?.['node-forge']!=='^1.3.3'||
    cert.dependencies?.['node-forge']!=='^1.3.3')
  block('Expo and node-forge graph must match pinned candidate');
 const pack=read(packPath,12*1024*1024),rsa=read(installedRsa),
  upstream=read(upstreamRsa),manifest=json(read(installedPackage,256*1024)),
  audit=json(read(auditPath,3*1024*1024));
 if(forge.integrity!=='sha512-'+sha512(pack))
  block('packed npm tarball fails exact lockfile SHA-512 integrity');
 if(manifest.name!=='node-forge'||manifest.version!=='1.4.1')
  block('installed npm package manifest disagrees');
 if(!rsa.equals(upstream))
  block('installed registry lib/rsa.js differs from immutable official forge Git commit');
 const s=rsa.toString('utf8');
 if(!s.includes('_encodeDigestInfo(oid, capture.digest, true)')||
    !s.includes('_encodeDigestInfo(oid, capture.digest, false)')||
    !s.includes('d.substring(0, withParameters.length) !== withParameters'))
  block('expected canonical DER DigestInfo branch absent');
 const a=audit.metadata?.vulnerabilities;
 if(!a||a.total!==0||a.high!==0||a.critical!==0||
    !audit.vulnerabilities||Object.keys(audit.vulnerabilities).length!==0)
  block('npm registry advisory report is nonzero or malformed');
 return {
  schemaVersion:1,sourceCommit:sha,
  scope:'PINNED_NPM_TARBALL_AND_OFFICIAL_TAG_BYTE_EQUIVALENCE_NOT_RELEASE_APPROVAL',
  approvedForProduction:false,stableReleaseAllowed:false,
  upstream:{repository:'digitalbazaar/forge',tag:'v1.4.1',tagCommit:COMMIT,
   npmPackage:'node-forge',version:'1.4.1',rsaSourceSha256:sha256(rsa),
   githubRsaSha256:sha256(upstream),npmTarballSha256:sha256(pack),
   npmLockIntegrity:forge.integrity},
  candidate:{lockSha256:sha256(lockBytes),componentCount:Object.keys(pk).length-1,
   codeSigningVersion:cert.version,expoCliVersion:cli.version,
   updatesVersion:updates.version,auditSnapshotSha256:sha256(read(auditPath)),
   auditSnapshotFindings:a.total},
  limitations:'No code-signing key, untrusted PEM, exploit, APK build or production review performed'
 };
}
function run(args){
 if(args.length!==9||!['capture','verify'].includes(args[0]))
  block('usage: capture|verify LOCK TARBALL INSTALLED_RSA GITHUB_RSA INSTALLED_PACKAGE AUDIT SOURCE_SHA REPORT');
 const [mode,...rest]=args,[lock,tar,rsa,github,manifest,audit,commit,out]=rest;
 const buf=Buffer.from(JSON.stringify(make(lock,tar,rsa,github,manifest,audit,commit),null,2)+'\n');
 if(mode==='capture'){
  if(fs.existsSync(out))block('refuse overwrite');
  fs.writeFileSync(out,buf,{flag:'wx',mode:0o600});
  console.log('PASS (LAB): npm tarball matches lock integrity and immutable forge v1.4.1 commit');
 }else{
  if(!read(out,3*1024*1024).equals(buf))block('independent provenance mismatch');
  console.log('PASS (LAB): independent npm installation and tarball exactly reproduce provenance');
 }
}
if(require.main===module){try{run(process.argv.slice(2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={make,run};
