#!/usr/bin/env node
'use strict';

// Laboratory inventory of Gradle's *resolved* releaseRuntimeClasspath.
// These coordinates are build-resolution evidence, NOT proof a class/AAR
// entered the APK and NOT an authenticated supply-chain attestation.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const MAX_REPORT=12*1024*1024;
const MAX_APK=1024*1024*1024;
const MAX_EVIDENCE=12*1024*1024;
const CONFIG='releaseRuntimeClasspath';

function block(reason){throw Error('BLOCK: Android Gradle runtime inventory: '+reason);}
function safeBytes(file,max){
  const st=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!st||st.isSymbolicLink()||!st.isFile()||st.size<4||st.size>max)
    block('missing, linked, nonregular or oversized '+path.basename(file));
  return fs.readFileSync(file);
}
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function parseReport(input){
  if(typeof input!=='string'||input.length<30)
    block('empty or unsafe ANSI/binary Gradle report');
  // Gradle and plugins can colorize stdout even with --console=plain.
  // Allow only ANSI Select Graphic Rendition (SGR) styling, never cursor
  // movement, OSC payloads, or arbitrary control bytes. Keep the *original*
  // raw report unchanged and bound to the APK by its SHA-256.
  const sgr=input.match(/\x1b\[[0-9;]*m/g)||[];
  if(sgr.length>10000)block('excessive Gradle terminal styling');
  const plain=input.replace(/\x1b\[[0-9;]*m/g,'');
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(plain))
    block('empty or unsafe ANSI/binary Gradle report');
  const lines=plain.replace(/\r\n/g,'\n').split('\n');
  const matches=lines.filter(line=>line.startsWith(CONFIG+' - '));
  if(matches.length!==1)block('missing or duplicate releaseRuntimeClasspath heading');
  const heading=lines.indexOf(matches[0]);
  let seenTree=false,closed=false,hasNoDependencies=false;
  const selected=new Map(),projects=new Set(),constraints=new Set();
  let edges=0,unparsed=0;
  for(let i=heading+1;i<lines.length;i++){
    const line=lines[i];
    if(/^[-]{4,}$/.test(line.trim()))continue;
    if(line.trim()==='No dependencies'){hasNoDependencies=true;continue;}
    const m=line.match(/(?:\+---|\\---)\s+(.+)$/);
    if(!m){
      if(seenTree&&(/^\S/.test(line)||line.startsWith('BUILD ')||line.startsWith('A web-based'))){closed=true;break;}
      continue;
    }
    if(closed)block('dependency text after closed Gradle graph');
    seenTree=true;
    const target=m[1].trim();
    if(/(?:^|\s)(?:FAILED|UNRESOLVED|NOT_FOUND)(?:\s|$)/.test(target))
      block('Gradle dependency could not resolve: '+target);
    if(/\(n\)\s*$/.test(target))
      block('Gradle marked dependency unresolved: '+target);
    if(/\(c\)\s*$/.test(target)){
      constraints.add(target.replace(/\s+\(c\)\s*$/,''));
      continue;
    }
    const raw=target.replace(/\s+\(\*\)\s*$/,'').trim();
    if(raw.startsWith('project :')){
      const pm=raw.match(/^project (:?[A-Za-z0-9_.:-]+)(?: -> project (:?[A-Za-z0-9_.:-]+))?$/);
      if(!pm)block('malformed Gradle project entry: '+target);
      projects.add(pm[2]||pm[1]);
      edges++;
      continue;
    }
    // Gradle prints both version selection (group:name:1 -> 2) and module
    // substitution (group:old:+ -> group:new:2). Inventory must record the
    // *selected* module, never the requested alias.
    const sides=raw.split(/\s+->\s+/);
    if(sides.length>2){unparsed++;block('unparsed Gradle classpath edge: '+target);}
    const full=/^([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+):([^\s:]+)$/;
    const noVersion=/^([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)$/;
    const requested=sides[0].match(full)||sides[0].match(noVersion);
    if(!requested){unparsed++;block('unparsed Gradle classpath edge: '+target);}
    let group,name,version;
    if(sides.length===1){
      if(!sides[0].match(full)){unparsed++;block('unparsed Gradle classpath edge: '+target);}
      [group,name,version]=requested.slice(1);
    } else {
      const chosenModule=sides[1].match(full);
      if(chosenModule){
        [group,name,version]=chosenModule.slice(1);
      } else {
        // Version-only right-hand side retains the requested module identity.
        if(!/^\S+$/.test(sides[1])||sides[1].includes(':')){
          unparsed++;block('unparsed Gradle classpath edge: '+target);
        }
        [group,name]=requested.slice(1,3);
        version=sides[1];
      }
    }
    if(!/^[0-9]+(?:\.[0-9A-Za-z_-]+)*(?:[-+._][0-9A-Za-z_-]+)*$/.test(version)||
       version.includes('..')||version.includes('+')||
       version==='undefined')
      block('Gradle did not resolve a concrete Maven component version: '+target);
    const key=group+':'+name+':'+version;
    selected.set(key,{group,name,version,coordinate:key});
    edges++;
  }
  if(!seenTree||hasNoDependencies||edges<3||selected.size<1)
    block('Gradle report is empty or missing resolved native libraries');
  if(selected.size>15000||projects.size>15000)
    block('unreasonable Android native component count');
  return {
    configuration:CONFIG,
    sourceFormat:'Gradle dependencies --configuration releaseRuntimeClasspath --console=plain',
    components:[...selected.values()].sort((a,b)=>a.coordinate.localeCompare(b.coordinate)),
    localProjects:[...projects].sort(),
    selectionEdgeCount:edges,
    constraintEdgeCount:constraints.size,
    parseErrors:unparsed
  };
}
function generate(report,apk,commit){
  if(typeof commit!=='string'||!/^[0-9a-f]{40}$/.test(commit))
    block('invalid GitHub commit SHA');
  const gradle=safeBytes(report,MAX_REPORT);
  const apkData=safeBytes(apk,MAX_APK);
  const inventory=parseReport(gradle.toString('utf8'));
  return {
    schemaVersion:1,
    approvedForProduction:false,
    scope:'LAB RESOLVED GRADLE GRAPH; NOT APK CONTAINED COMPONENTS',
    sourceCommit:commit,
    apkSha256:sha256(apkData),
    gradleReportSha256:sha256(gradle),
    ...inventory
  };
}
const serialize=obj=>Buffer.from(JSON.stringify(obj,null,2)+'\n');
function capture(report,apk,commit,out){
  const evidence=generate(report,apk,commit);
  if(fs.existsSync(out))block('refusing to overwrite prior inventory');
  fs.writeFileSync(out,serialize(evidence),{flag:'wx',mode:0o600});
  console.log('PASS (LAB): Android releaseRuntimeClasspath inventory has '+
    evidence.components.length+' external modules and '+evidence.localProjects.length+' projects');
}
function verify(report,apk,commit,evidence){
  const original=safeBytes(evidence,MAX_EVIDENCE);
  const expected=serialize(generate(report,apk,commit));
  if(!original.equals(expected))block('downloaded Gradle graph/APK/SHA differs from producer inventory');
  console.log('PASS (LAB): Gradle inventory matches downloaded APK sha, source SHA and complete raw graph');
}
function main(args){
  if(args.length!==5||!['capture','verify'].includes(args[0])){
    console.error('Usage: gradle_release_runtime_inventory.cjs capture|verify <report.txt> <apk> <commit-sha> <inventory.json>');
    return 2;
  }
  try{const [mode,report,apk,sha,out]=args;mode==='capture'?capture(report,apk,sha,out):verify(report,apk,sha,out);return 0;}
  catch(e){console.error(e.message);return 1;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={parseReport,generate,capture,verify};
