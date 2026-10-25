#!/usr/bin/env node
'use strict';
// Research only. Never authorize stable signing or dependency promotion.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function block(message){throw Error('BLOCK: image-size major feasibility: '+message);}
function read(file){
  const s=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!s||s.isSymbolicLink()||!s.isFile()||s.size<5||s.size>8*1024*1024)
    block('missing, linked or oversized snapshot '+path.basename(file));
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch{block('invalid JSON '+path.basename(file));}
}
function packageVersions(lock,name){
  if(lock?.lockfileVersion!==3||lock.name!=='@negresco/mobile'||lock.version!=='3.1.3'||!lock.packages)
    block('wrong npm lockfile identity');
  const result=[];
  for(const [key,value] of Object.entries(lock.packages)){
    if(key==='node_modules/'+name||key.endsWith('/node_modules/'+name)){
      if(!value||typeof value.version!=='string'||!value.integrity||!value.resolved)
        block('incomplete lock package '+key);
      result.push([key,value.version]);
    }
  }
  return result.sort((a,b)=>a[0].localeCompare(b[0]));
}
function advisoryCounts(json){
  const c=json?.metadata?.vulnerabilities;
  if(json?.auditReportVersion!==2||json.error||!c||!json.vulnerabilities)
    block('invalid npm advisory report');
  for(const s of ['info','low','moderate','high','critical','total'])
    if(!Number.isSafeInteger(c[s])||c[s]<0)block('missing severity count '+s);
  if(['info','low','moderate','high','critical'].reduce((n,k)=>n+c[k],0)!==c.total)
    block('advisory counts disagree');
  return c;
}
function compare(baseline,candidate,beforeAudit,afterAudit){
  const b=baseline.packages,c=candidate.packages;
  packageVersions(baseline,'expo');packageVersions(candidate,'expo');
  for(const name of ['expo','expo-updates','react','react-native','postcss','node-forge']){
    const before=packageVersions(baseline,name),after=packageVersions(candidate,name);
    if(!before.length||JSON.stringify(before)!==JSON.stringify(after))
      block('unexpected Expo/core/postcss/node-forge version change: '+name);
  }
  const before=packageVersions(baseline,'image-size');
  const after=packageVersions(candidate,'image-size');
  if(!before.length||!after.length||before.every((x)=>x[1]==='2.0.3')||
     after.some((x)=>x[1]!=='2.0.3'))
    block('image-size is not a real pinned upgrade to 2.0.3');
  const oldCounts=advisoryCounts(beforeAudit),newCounts=advisoryCounts(afterAudit);
  if(newCounts.total>=oldCounts.total||newCounts.high>oldCounts.high||
     newCounts.critical>oldCounts.critical)
    block('major upgrade did not reduce advisory totals safely');
  const changed=[...new Set([...Object.keys(b),...Object.keys(c)])]
    .filter(key=>key&&JSON.stringify(b[key])!==JSON.stringify(c[key])).sort();
  const safeQueueRemoval=(key)=>{
    if(key!=='node_modules/queue'||!b[key]||c[key]!==undefined||
       b['node_modules/image-size']?.dependencies?.queue!==b[key].version)
      return false;
    // The old queue may only be dropped if image-size was its sole owner.
    // Otherwise the candidate has silently removed a required dependency.
    return Object.entries(b).every(([name,entry])=>
      name==='node_modules/image-size'||entry?.dependencies?.queue===undefined);
  };
  if(changed.length>80||changed.some(key=>!key.endsWith('/image-size')&&!safeQueueRemoval(key)))
    block('unexpected transitive dependency change beyond image-size: '+
      changed.slice(0,30).map(key=>key+':'+(b[key]?.version??'missing')+'->'+(c[key]?.version??'missing')).join(', '));
  return {
    label:'UNREVIEWED IMAGE-SIZE MAJOR EXPERIMENT - DO NOT PUBLISH',
    reviewed:false,expoUnchanged:true,
    patchedImageSize:'2.0.3',baselineImageSize:before,candidateImageSize:after,
    baselineAdvisories:oldCounts,candidateAdvisories:newCounts,
    changedPackages:changed.map(key=>({path:key,from:b[key]?.version||null,to:c[key]?.version||null})),
    warnings:['Major API compatibility is not assured by npm audit or a lockfile.',
      'node-forge remains affected without an upstream fix.',
      'No production dependency has been changed.']
  };
}
function sha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
function main(argv){
  if(argv.length!==5){console.error('Usage: compare_image_size_major.cjs <base.lock> <candidate.lock> <base.audit> <candidate.audit> <report.json>');return 2;}
  try{
    const result=compare(read(argv[0]),read(argv[1]),read(argv[2]),read(argv[3]));
    result.sourceDigests={baselineLock:sha(argv[0]),candidateLock:sha(argv[1]),
      baselineAudit:sha(argv[2]),candidateAudit:sha(argv[3])};
    fs.writeFileSync(argv[4],JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('PASS (LAB): image-size major experiment: '+result.baselineAdvisories.total+
      ' -> '+result.candidateAdvisories.total+' advisories; packages changed '+result.changedPackages.length);
    return 0;
  }catch(e){console.error(e.message);return 1;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={compare,packageVersions,advisoryCounts};
