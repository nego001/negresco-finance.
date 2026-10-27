#!/usr/bin/env node
'use strict';
// Capture names from the Gradle createBundleReleaseJsAndAssets *packager* map.
// The map is produced by the APK build, but is NOT a formal reachability proof.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const SHA=/^[0-9a-f]{40}$/,HASH=/^[0-9a-f]{64}$/;
const expected='index.android.bundle.packager.map';
const method='GRADLE_PACKAGER_MAP_SAME_BUILD_NOT_HERMES_BYTECODE_REACHABILITY';
const conclusion='Gradle-generated packager map, not executable-call graph; host build dependencies remain in scope';
const markers={
 nodeForge:'node_modules/node-forge/',
 expoCli:'node_modules/@expo/cli/',
 codeSigningCertificates:'node_modules/@expo/code-signing-certificates/',
 expoUpdates:'node_modules/expo-updates/'
};
function block(why){throw Error('BLOCK: Gradle source-map inventory: '+why);}
function source(file,max){
 let st;
 try{st=fs.lstatSync(file);}catch{block('required file missing');}
 if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>max)
  block('unsafe file size/type');
 return fs.readFileSync(file);
}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function parse(bytes,label){try{return JSON.parse(bytes.toString('utf8'));}
 catch{block('malformed '+label);}}
function keys(o,expected,label){
 if(!o||typeof o!=='object'||Array.isArray(o)||
    Object.keys(o).sort().join('|')!==expected.slice().sort().join('|'))
  block('unexpected fields in '+label);
}
function bundle(apk,lock,hermes,commit){
 if(!SHA.test(commit))block('invalid source commit');
 const ab=source(apk,1024**3),lb=source(lock,32*1024**2),hb=source(hermes,4*1024**2);
 const l=parse(lb,'lockfile'),h=parse(hb,'Hermes inventory');
 if(l.lockfileVersion!==3||l.packages?.['node_modules/node-forge']?.version!=='1.4.0'||
    l.packages?.['node_modules/@expo/code-signing-certificates']?.version!=='0.0.6')
  block('unexpected npm dependency graph');
 if(h.schemaVersion!==1||h.approvedForProduction!==false||
    h.sourceCommit!==commit||h.apkSha256!==hash(ab)||
    h.jsPayload?.kind!=='hermes-bytecode'||!HASH.test(String(h.jsPayload.sha256))||
    !HASH.test(String(h.nativeBinaryInventorySha256)))
  block('APK/Hermes inventory provenance mismatch');
 return {apkSha256:hash(ab),npmLockSha256:hash(lb),
  hermesEvidenceSha256:hash(hb),packagedHermesSha256:h.jsPayload.sha256};
}
function countMap(file){
 if(path.basename(file)!==expected)block('not canonical Gradle packager map');
 const buf=source(file,96*1024**2),m=parse(buf,'Gradle packager source map');
 if(m.version!==3||!Array.isArray(m.sources)||m.sources.length<2||
    m.sources.length>2000000||!m.sources.every(s=>typeof s==='string'&&s.length>0&&s.length<4096))
  block('malformed Gradle source map');
 const names=[...new Set(m.sources.map(s=>s.replaceAll('\\','/')))].sort();
 const counts={};
 for(const [k,marker] of Object.entries(markers))
  counts[k]=names.filter(s=>s.includes(marker)).length;
 return {gradlePackagerMapSha256:hash(buf),sourceCount:names.length,
  sourceNameSha256:hash(Buffer.from(names.join('\n'),'utf8')),packageCounts:counts};
}
function capture(map,apk,lock,hermes,commit,out){
 const linked=bundle(apk,lock,hermes,commit);
 const summary=countMap(map);
 const report={schemaVersion:1,approvedForProduction:false,productionReleaseAllowed:false,
  mapOrigin:'Gradle createBundleReleaseJsAndAssets / react/release/index.android.bundle.packager.map',
  method,conclusion,sourceCommit:commit,...linked,observedGradlePackager:summary,
  advisory:{id:'GHSA-86w9-cpqp-85rv',lockedNodeForgeVersion:'1.4.0'}};
 if(fs.existsSync(out))block('refusing to overwrite evidence');
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('PASS (LAB): source names inventoried from SAME GRADLE BUILD, not independent Metro export');
 for(const [k,v] of Object.entries(summary.packageCounts))console.log('GRADLE OBSERVED '+k+': '+v);
 return report;
}
function verify(apk,lock,hermes,commit,report){
 const linked=bundle(apk,lock,hermes,commit);
 const v=parse(source(report,4*1024**2),'Gradle source summary');
 keys(v,['schemaVersion','approvedForProduction','productionReleaseAllowed','mapOrigin',
  'method','conclusion','sourceCommit','apkSha256','npmLockSha256','hermesEvidenceSha256',
  'packagedHermesSha256','observedGradlePackager','advisory'],'Gradle source report');
 keys(v.observedGradlePackager,['gradlePackagerMapSha256','sourceCount',
  'sourceNameSha256','packageCounts'],'Gradle map summary');
 keys(v.observedGradlePackager.packageCounts,Object.keys(markers),'package counts');
 keys(v.advisory,['id','lockedNodeForgeVersion'],'advisory');
 if(v.schemaVersion!==1||v.approvedForProduction!==false||
    v.productionReleaseAllowed!==false||v.method!==method||v.conclusion!==conclusion||
    v.mapOrigin!=='Gradle createBundleReleaseJsAndAssets / react/release/index.android.bundle.packager.map'||
    v.sourceCommit!==commit||v.advisory.id!=='GHSA-86w9-cpqp-85rv'||
    v.advisory.lockedNodeForgeVersion!=='1.4.0'||
    !Object.entries(linked).every(([k,value])=>v[k]===value))
  block('downloaded summary mismatched APK, lockfile or Hermes');
 const s=v.observedGradlePackager;
 if(!HASH.test(String(s.gradlePackagerMapSha256))||
    !HASH.test(String(s.sourceNameSha256))||
    !Number.isSafeInteger(s.sourceCount)||s.sourceCount<2||s.sourceCount>2000000||
    !Object.values(s.packageCounts).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=s.sourceCount))
  block('invalid map hash or counts');
 console.log('PASS (LAB): downloaded Gradle map summary tied to APK/Hermes/lock and production blocked');
 console.log('LIMIT: raw Gradle map not shipped; source counts cannot be independently recalculated');
 return true;
}
function main(argv){
 if(!['capture','verify'].includes(argv[0])||(argv[0]==='capture'&&argv.length!==7)||(argv[0]==='verify'&&argv.length!==6))
  block('Usage: capture MAP APK LOCK HERMES COMMIT OUT | verify APK LOCK HERMES COMMIT OUT');
 const [mode,a,b,c,d,e,f]=argv;
 if(mode==='capture')return capture(a,b,c,d,e,f);
 return verify(a,b,c,d,e);
}
if(require.main===module)try{main(process.argv.slice(2));}
 catch(e){console.error(e.message);process.exitCode=1;}
module.exports={capture,verify,countMap};
