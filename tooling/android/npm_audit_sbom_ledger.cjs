#!/usr/bin/env node
'use strict';

// Produces and independently verifies a deterministic npm-advisory ledger
// derived from the SAME lockfile, npm audit JSON and CycloneDX SBOM as the
// disposable Android APK. Evidence, not vulnerability remediation or SLSA.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {parseUniqueJson}=require('./verify_stable_npm_lock.cjs');
const {sbom}=require('./npm_lock_cyclonedx_sbom.cjs');

const MAX=8*1024*1024;
const SEVERITIES=['info','low','moderate','high','critical'];
function block(msg){throw Error('BLOCK: npm advisory evidence: '+msg);}
function source(file){
  const st=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!st||st.isSymbolicLink()||!st.isFile()||st.size<2||st.size>MAX)
    block('missing, linked or oversized '+path.basename(file));
  return fs.readFileSync(file);
}
function read(bytes,label){
  try{return parseUniqueJson(bytes.toString('utf8'));}
  catch(e){block('unparseable/duplicate-key '+label+': '+e.message);}
}
function hash(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
function finalName(key){
  const n=key.split('node_modules/').at(-1);
  if(!/^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/.test(n))block('invalid package path '+key);
  return n;
}
function generate(lockBytes,auditBytes,feasibilityBytes,bomBytes){
  const lock=read(lockBytes,'lockfile'),audit=read(auditBytes,'npm audit');
  const feasibility=read(feasibilityBytes,'feasibility report');
  const existingBom=read(bomBytes,'CycloneDX BOM');
  const canonicalBom=sbom(lockBytes);
  if(JSON.stringify(existingBom)!==JSON.stringify(canonicalBom))
    block('SBOM does not match exact npm lockfile');
  if(lock.name!=='@negresco/mobile'||lock.version!=='3.1.3'||
     feasibility.label!=='UNREVIEWED IMAGE-SIZE MAJOR EXPERIMENT - DO NOT PUBLISH'||
     feasibility.reviewed!==false||feasibility.sourceDigests?.candidateLock!==hash(lockBytes))
    block('npm lock source or feasibility identity mismatch');
  if(audit.auditReportVersion!==2||audit.error||!plain(audit.vulnerabilities)||
     !plain(audit.metadata?.vulnerabilities))
    block('unavailable or invalid registry npm audit');
  const counts=audit.metadata.vulnerabilities;
  for(const sev of [...SEVERITIES,'total'])
    if(!Number.isSafeInteger(counts[sev])||counts[sev]<0)
      block('missing npm advisory count '+sev);
  if(SEVERITIES.reduce((n,s)=>n+counts[s],0)!==counts.total)
    block('npm advisory counts do not add up');
  if(counts.total!==5||counts.high!==5||counts.critical!==0||
     feasibility.candidateAdvisories?.total!==5||
     feasibility.candidateAdvisories?.high!==5)
    block('unexpected registry risk snapshot, requires renewed independent review');
  const vulnerable=audit.vulnerabilities;
  const names=Object.keys(vulnerable).sort();
  if(names.length!==counts.total)block('npm audit omitted or inserted vulnerable packages');
  const bySeverity=Object.fromEntries(SEVERITIES.map(k=>[k,0]));
  const entries=names.map(name=>{
    const data=vulnerable[name];
    if(!plain(data)||data.name!==name||!SEVERITIES.includes(data.severity)||
       typeof data.isDirect!=='boolean'||!Array.isArray(data.via)||
       !Array.isArray(data.effects)||!Array.isArray(data.nodes)||!data.nodes.length)
      block('malformed npm advisory for '+name);
    bySeverity[data.severity]++;
    const nodes=[...new Set(data.nodes)].sort();
    if(nodes.length!==data.nodes.length)block('duplicate npm advisory paths for '+name);
    const versions=nodes.map(location=>{
      if(typeof location!=='string'||finalName(location)!==name)
        block('npm advisory node name mismatch '+name);
      const pkg=lock.packages[location];
      if(!plain(pkg)||typeof pkg.version!=='string'||
         !canonicalBom.components.some(c=>c['bom-ref']==='npm-lock:'+location&&c.version===pkg.version))
        block('npm advisory points to a missing locked SBOM component '+location);
      return {location,version:pkg.version};
    });
    const refs=[];
    const advisories=[];
    for(const via of data.via){
      if(typeof via==='string'){
        if(!vulnerable[via])block('unresolved transitive advisory link '+name+' -> '+via);
        refs.push(via);
      }else if(plain(via)){
        if(via.name!==name||via.dependency!==name||via.severity!==data.severity||
           typeof via.url!=='string'||!/^https:\/\/github\.com\/advisories\/GHSA-[\w-]+$/.test(via.url))
          block('invalid primary advisory entry for '+name);
        advisories.push({url:via.url,title:via.title||'',range:via.range||''});
      }else block('unknown npm advisory via entry for '+name);
    }
    if(!data.via.length)block('missing advisory causality for '+name);
    for(const eff of data.effects){
      if(typeof eff!=='string'||!vulnerable[eff])block('unresolved reverse advisory effect for '+name);
    }
    return {name,severity:data.severity,isDirect:data.isDirect,
      lockedVersions:versions,viaPackages:[...new Set(refs)].sort(),
      advisorySources:advisories.sort((a,b)=>a.url<b.url?-1:a.url>b.url?1:0),
      affectedPackages:[...new Set(data.effects)].sort()};
  });
  if(SEVERITIES.some(x=>bySeverity[x]!==counts[x]))
    block('per-package npm vulnerability severity mismatch');
  const primary=entries.filter(x=>x.advisorySources.length>0);
  if(primary.length!==1||primary[0].name!=='node-forge'||
     !primary[0].advisorySources.some(x=>x.url==='https://github.com/advisories/GHSA-86w9-cpqp-85rv'))
    block('root npm advisory identity changed; human investigation required');
  for(const item of entries){
    if(item.name==='node-forge')continue;
    const visited=new Set(),todo=[item.name];let reaches=false;
    while(todo.length){
      const key=todo.shift();
      if(visited.has(key))continue;
      visited.add(key);
      if(key==='node-forge'){reaches=true;break;}
      const next=entries.find(x=>x.name===key);
      if(!next)block('unresolved advisory chain node '+key);
      todo.push(...next.viaPackages);
    }
    if(!reaches)block('advisory not linked to expected node-forge root: '+item.name);
  }
  return {schemaVersion:1,status:'UNREVIEWED LAB: FIVE HIGH NPM ADVISORIES; STABLE RELEASE BLOCKED',
    productionApproved:false,scope:'npm registry advisories over exact reviewed laboratory build graph',
    hashes:{lockSha256:hash(lockBytes),auditSha256:hash(auditBytes),
      feasibilitySha256:hash(feasibilityBytes),sbomSha256:hash(bomBytes)},
    counts:Object.fromEntries([...SEVERITIES,'total'].map(x=>[x,counts[x]])),
    vulnerabilities:entries};
}
function bytes(...files){return Buffer.from(JSON.stringify(generate(...files.map(source)),null,2)+'\n');}
function capture(files,output){
  if(fs.existsSync(output))block('refuse to overwrite advisory ledger');
  const data=bytes(...files);
  fs.writeFileSync(output,data,{flag:'wx',mode:0o600});
  console.log('PASS (LAB): generated advisory evidence with five unresolved high-risk npm packages');
}
function verify(files,output){
  const actual=source(output),expected=bytes(...files);
  if(!actual.equals(expected))block('downloaded advisory evidence differs from lock, audit, feasibility or SBOM');
  console.log('PASS (LAB): downloaded npm advisory evidence matches five HIGH findings and exact installed dependency versions');
}
function main(argv){
  if(argv.length!==6||!['capture','verify'].includes(argv[0])){
    console.error('Usage: npm_audit_sbom_ledger.cjs <capture|verify> <lock> <audit> <feasibility> <bom> <ledger>');
    return 2;
  }
  try{
    const [mode,...paths]=argv;
    if(mode==='capture')capture(paths.slice(0,4),paths[4]);
    else verify(paths.slice(0,4),paths[4]);
    return 0;
  }catch(e){console.error(e.message);return 1;}
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={generate,capture,verify,main};
