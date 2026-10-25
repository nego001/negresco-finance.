#!/usr/bin/env node
'use strict';

// Compare two independently generated npm lock/audit snapshots. This is only
// a laboratory feasibility assessment, never approval for stable publishing.
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');

const TARGET='8.5.23';
const MAX_BYTES=8*1024*1024;
function block(reason){throw new Error('BLOCK: npm PostCSS patch lab: '+reason);}
function read(file){
  const st=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!st||st.isSymbolicLink()||!st.isFile()||st.size<2||st.size>MAX_BYTES)
    block('absent, linked, or oversized snapshot: '+path.basename(file));
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch{block('invalid JSON snapshot: '+path.basename(file));}
}
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function versions(lock,name){
  if(!lock||lock.lockfileVersion!==3||!lock.packages||
     typeof lock.packages!=='object')block('invalid npm v3 lockfile');
  const result=[];
  for(const [key,p] of Object.entries(lock.packages)){
    if(key==='node_modules/'+name||key.endsWith('/node_modules/'+name)){
      if(typeof p.version!=='string'||!p.integrity||!p.resolved)
        block('incomplete package record for '+name);
      result.push({path:key,version:p.version});
    }
  }
  return result.sort((a,b)=>a.path.localeCompare(b.path));
}
function severity(a){
  if(a?.auditReportVersion!==2||a.error||!a.metadata?.vulnerabilities||
     !a.vulnerabilities||typeof a.vulnerabilities!=='object')
    block('invalid npm advisory response');
  const counts=a.metadata.vulnerabilities;
  for(const k of ['info','low','moderate','high','critical','total']){
    if(!Number.isSafeInteger(counts[k])||counts[k]<0)
      block('incomplete advisory counts');
  }
  if(['info','low','moderate','high','critical'].reduce((a,k)=>a+counts[k],0)!==counts.total)
    block('inconsistent advisory totals');
  return counts;
}
function assess(base,patched,auditBefore,auditAfter){
  const baseline=base.packages,updated=patched.packages;
  if(!baseline||!updated||baseline['']?.name!=='@negresco/mobile'||
     updated['']?.name!=='@negresco/mobile'||base.lockfileVersion!==3||
     patched.lockfileVersion!==3)block('wrong project or lockfile version');
  if(base.version!=='3.1.3'||patched.version!=='3.1.3')
    block('unexpected mobile app version');
  for(const name of ['expo','expo-updates','react','react-native']){
    const orig=versions(base,name);
    const next=versions(patched,name);
    if(!orig.length||JSON.stringify(orig)!==JSON.stringify(next))
      block('core Expo/React package drift in patch experiment: '+name);
  }
  const originalPostcss=versions(base,'postcss');
  const updatedPostcss=versions(patched,'postcss');
  if(!originalPostcss.length||!updatedPostcss.length)
    block('PostCSS is not present in both lockfiles');
  if(updatedPostcss.some(x=>x.version!==TARGET))
    block('PostCSS version is not pinned to '+TARGET);
  if(originalPostcss.every(x=>x.version===TARGET))
    block('control already contains patched PostCSS');
  const before=severity(auditBefore),after=severity(auditAfter);
  if(after.critical>before.critical||after.high>before.high||after.total>before.total)
    block('patch experiment increased npm advisory risk');
  const names=[...new Set([...Object.keys(baseline),...Object.keys(updated)])]
    .filter(x=>x&&JSON.stringify(baseline[x])!==JSON.stringify(updated[x]))
    .sort();
  if(names.length>150)block('too much npm lock graph drift for focused experiment');
  const changes=names.map(key=>({
    path:key,previous:baseline[key]?.version??null,next:updated[key]?.version??null
  }));
  return {
    label:'UNREVIEWED EXPERIMENT - NEVER PUBLISH',
    reviewed:false,baselineAdvisories:before,candidateAdvisories:after,
    beforePostcss:originalPostcss,afterPostcss:updatedPostcss,
    expoUnchanged:true,otherChangedPackages:changes.length,
    changedPackages:changes,
    warnings:[
      'A lower advisory count does not establish compatible Android builds.',
      'node-forge and image-size have no confirmed npm fix in this snapshot.',
      'Manual review, npm ci, Android emulator tests and signed OTA are still required.'
    ]
  };
}
function main(argv){
  if(argv.length!==5){
    console.error('Usage: node tooling/android/assess_postcss_patch_candidate.cjs <old-lock> <new-lock> <old-audit> <new-audit> <output>');
    return 2;
  }
  try{
    const result=assess(read(argv[0]),read(argv[1]),read(argv[2]),read(argv[3]));
    result.sourceDigests={
      baselineLockSha256:sha(argv[0]),
      candidateLockSha256:sha(argv[1]),
      baselineAuditSha256:sha(argv[2]),
      candidateAuditSha256:sha(argv[3])
    };
    if(fs.existsSync(argv[4]))block('refuse to overwrite existing report');
    fs.writeFileSync(argv[4],JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('PASS (LAB ONLY): PostCSS '+TARGET+' comparison produced '+result.otherChangedPackages+
      ' package changes; advisories '+result.baselineAdvisories.total+' -> '+result.candidateAdvisories.total);
    return 0;
  }catch(e){console.error(e.message);return 1;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={assess,versions,severity};
