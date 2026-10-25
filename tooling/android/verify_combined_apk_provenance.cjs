#!/usr/bin/env node
'use strict';

// LAB ONLY. Binds the sha256 digest of the candidate npm lockfile and OTA
// preview APK in one evidence record. This is NOT a signed SLSA attestation.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const MAX_APK=1024*1024*1024;
const MAX_JSON=8*1024*1024;
function block(msg){throw Error('BLOCK: combined APK dependency provenance: '+msg);}
function ordinary(file,max){
  const stat=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!stat||stat.isSymbolicLink()||!stat.isFile()||stat.size<2||stat.size>max)
    block('missing/linked/nonregular/oversized file: '+path.basename(file));
  return stat;
}
function digest(file,max){
  ordinary(file,max);
  const bytes=fs.readFileSync(file);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function json(file){
  ordinary(file,MAX_JSON);
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch{block('unparseable JSON: '+path.basename(file));}
}
function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
function preciseChanges(changed){
  return Array.isArray(changed)&&changed.length===2&&
    changed[0].path==='node_modules/image-size'&&
    changed[0].from==='1.2.1'&&changed[0].to==='2.0.3'&&
    changed[1].path==='node_modules/queue'&&
    changed[1].from==='6.0.2'&&changed[1].to===null;
}
function validateInputs(apkFile,lockFile,reportFile,sha){
  if(!/^[0-9a-f]{40}$/.test(sha))block('untrusted Git commit SHA');
  const apkSize=ordinary(apkFile,MAX_APK).size;
  const artifactHash=digest(apkFile,MAX_APK);
  const lockHash=digest(lockFile,MAX_JSON);
  const reportHash=digest(reportFile,MAX_JSON);
  const lock=json(lockFile),report=json(reportFile);
  if(lock.lockfileVersion!==3||lock.name!=='@negresco/mobile'||lock.version!=='3.1.3'||
     !plain(lock.packages)||!plain(lock.packages[''])||
     !plain(lock.packages['node_modules/postcss'])||
     !plain(lock.packages['node_modules/image-size'])||
     lock.packages['node_modules/postcss'].version!=='8.5.23'||
     lock.packages['node_modules/image-size'].version!=='2.0.3'||
     lock.packages['node_modules/queue']!==undefined)
    block('candidate npm graph does not contain expected PostCSS/image-size combination');
  if(report.label!=='UNREVIEWED IMAGE-SIZE MAJOR EXPERIMENT - DO NOT PUBLISH'||
     report.reviewed!==false||report.expoUnchanged!==true||
     report.patchedImageSize!=='2.0.3'||!preciseChanges(report.changedPackages)||
     report.sourceDigests?.candidateLock!==lockHash||
     report.baselineAdvisories?.high!==6||report.baselineAdvisories?.total!==6||
     report.candidateAdvisories?.high!==5||report.candidateAdvisories?.total!==5)
    block('candidate feasibility report is not bound to reviewed laboratory policy');
  return {
    schemaVersion:1,
    status:'UNREVIEWED LAB APK / NOT A PRODUCTION RELEASE',
    reviewerApproved:false,
    sourceCommit:sha,
    apk:{sha256:artifactHash,sizeBytes:apkSize},
    dependencies:{
      lockSha256:lockHash,feasibilitySha256:reportHash,
      postcssVersion:'8.5.23',imageSizeVersion:'2.0.3',queueRemoved:true,
      highAdvisories:5
    }
  };
}
function sameEvidence(a,b){
  return JSON.stringify(a)===JSON.stringify(b);
}
function capture(apk,lock,report,destination,commit){
  const evidence=validateInputs(apk,lock,report,commit);
  if(fs.existsSync(destination))block('refuse to overwrite provenance report');
  fs.writeFileSync(destination,JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('PASS (LAB): APK SHA-256 bound to exact experimental lock and Git SHA '+commit);
}
function verify(apk,lock,report,provenance,commit){
  const evidence=json(provenance);
  const expected=validateInputs(apk,lock,report,commit);
  if(!plain(evidence)||Object.keys(evidence).sort().join(',')!=='apk,dependencies,reviewerApproved,schemaVersion,sourceCommit,status'||
     !sameEvidence(evidence,expected))
    block('downloaded APK/lock/evidence relationship differs from producer');
  console.log('PASS (LAB): downloaded APK cryptographically matches evidence for candidate lock and source commit');
}
function main(argv){
  if(argv.length!==6||!['capture','verify'].includes(argv[0])){
    console.error('Usage: verify_combined_apk_provenance.cjs <capture|verify> <apk> <lock> <report> <evidence.json> <git-sha>');
    return 2;
  }
  try{
    const [operation,apk,lock,report,evidence,sha]=argv;
    if(operation==='capture')capture(apk,lock,report,evidence,sha);
    else verify(apk,lock,report,evidence,sha);
    return 0;
  }catch(e){console.error(e.message);return 1;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={validateInputs,capture,verify,main};
