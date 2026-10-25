#!/usr/bin/env node
'use strict';

// Admission gate for the trusted npm audit response of a future stable
// release. npm audit is run directly on the reviewed lockfile by the workflow.
// This reports known advisories, not package authenticity or malware.
const fs=require('node:fs');
const path=require('node:path');

const MAX_AUDIT=4*1024*1024;
const LEVELS=['info','low','moderate','high','critical'];
function block(msg){throw new Error('BLOCK: stable npm advisory policy: '+msg);}
function isPlain(o){return o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;}
function inspect(report){
  if(!isPlain(report)||report.auditReportVersion!==2||report.error||
      !isPlain(report.metadata)||!isPlain(report.metadata.vulnerabilities)||
      !isPlain(report.vulnerabilities))
    block('missing, invalid or erroring registry advisory report');
  const counts=report.metadata.vulnerabilities;
  for(const name of [...LEVELS,'total']){
    if(!Number.isSafeInteger(counts[name])||counts[name]<0)
      block('invalid advisory count: '+name);
  }
  const total=LEVELS.reduce((n,k)=>n+counts[k],0);
  if(total!==counts.total)block('advisory totals disagree with severity counts');
  const calculated=Object.fromEntries(LEVELS.map(k=>[k,0]));
  let packages=0;
  for(const [name,entry] of Object.entries(report.vulnerabilities)){
    if(typeof name!=='string'||!name||!isPlain(entry)||!LEVELS.includes(entry.severity)||
       typeof entry.isDirect!=='boolean'||!Array.isArray(entry.via))
      block('invalid advisory entry: '+name);
    calculated[entry.severity]++;
    packages++;
  }
  if(packages!==counts.total||LEVELS.some(k=>calculated[k]!==counts[k]))
    block('registry advisory entries do not match severity totals');
  if(total>0)
    block('lockfile has '+counts.high+' high, '+counts.critical+' critical, '+
      counts.moderate+' moderate, '+counts.low+' low and '+counts.info+
      ' informational reported vulnerable packages');
  return total;
}
function verify(file){
  const stat=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!stat||stat.isSymbolicLink()||!stat.isFile()||!stat.size||stat.size>MAX_AUDIT)
    block('missing, linked, empty or oversized npm audit report');
  let report;
  try{report=JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(e){block('unparseable npm audit JSON');}
  return inspect(report);
}
function main(args){
  if(args.length!==1){
    console.error('Usage: node tooling/android/verify_stable_npm_audit.cjs <npm-audit-report.json>');
    return 2;
  }
  try{
    verify(path.resolve(args[0]));
    console.log('PASS: npm stable lock registry advisory report has zero disclosed vulnerable packages');
    return 0;
  }catch(e){console.error(e.message);return 1;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={inspect,verify,main};
