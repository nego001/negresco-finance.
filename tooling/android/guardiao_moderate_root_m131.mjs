import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {summarize} from './guardiao_locked_audit_m123.mjs';
const validName=n=>typeof n==='string'&&/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(n);
function resolveLocked(packages,parent,name){
 let at=parent;
 while(true){
  const path=(at?at+'/':'')+'node_modules/'+name;
  if(Object.hasOwn(packages,path))return path;
  if(!at)return null;
  const i=at.lastIndexOf('/node_modules/');
  at=i<0?'':at.slice(0,i);
 }
}
export function analyze(lock,report,status){
 const summary=summarize(report,status,lock);
 const findings=report.vulnerabilities,packages=lock.packages;
 const roots=new Map(),edges=new Map();
 for(const [name,v] of Object.entries(findings)){
  if(!validName(name)||!Array.isArray(v.via)||v.via.length===0)throw Error('missing advisory evidence');
  const direct=[],links=[];
  for(const item of v.via){
   if(typeof item==='string'){
    if(!validName(item)||!Object.hasOwn(findings,item))throw Error('unresolved advisory edge');
    links.push(item);
   }else{
    if(!item||item.name!==name||!Number.isInteger(item.source)||typeof item.range!=='string'||item.range.length>500||!['info','low','moderate','high','critical'].includes(item.severity))throw Error('invalid advisory');
    direct.push({source:item.source,range:item.range,severity:item.severity});
   }
  }
  if(direct.length)roots.set(name,direct);
  edges.set(name,links);
 }
 function reachable(name){
  const seen=new Set(),found=new Set(),stack=[name];
  while(stack.length){const n=stack.pop();if(seen.has(n))continue;seen.add(n);if(roots.has(n))found.add(n);stack.push(...edges.get(n))}
  if(!found.size)throw Error('no direct advisory reachable');
  return [...found].sort();
 }
 const rows=summary.findings.map(f=>({...f,advisoryRoots:reachable(f.name),hasDirectAdvisory:roots.has(f.name)}));
 const rootFindings=[...roots].sort(([a],[b])=>a.localeCompare(b)).map(([name,advisories])=>{
  const nodes=findings[name].nodes;
  const parents=[];
  for(const [parent,entry] of Object.entries(packages)){
   for(const field of ['dependencies','optionalDependencies','peerDependencies','devDependencies']){
    const range=entry[field]?.[name];
    if(typeof range!=='string')continue;
    const path=resolveLocked(packages,parent,name);
    if(path&&nodes.includes(path))parents.push({parent:parent||'(root)',parentVersion:entry.version??null,field,range,resolved:path});
   }
  }
  return {name,advisories,nodes:nodes.map(path=>({path,version:packages[path].version})),parents,affectedFindings:rows.filter(x=>x.advisoryRoots.includes(name)).map(x=>x.name)};
 });
 return {total:summary.total,counts:summary.counts,rootPackageCount:rootFindings.length,derivedOnlyCount:rows.filter(x=>!x.hasDirectAdvisory).length,rootFindings,findings:rows,approvedForProduction:false,stableReleaseAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==5||!['0','1'].includes(process.argv[4]))throw Error('args');
  const [lock,report]=process.argv.slice(2,4).map(p=>JSON.parse(readFileSync(p,'utf8')));
  console.log(JSON.stringify(analyze(lock,report,Number(process.argv[4])),null,2));
 }catch{console.error('BLOCK (LAB): incomplete or inconsistent advisory graph');process.exitCode=1}
}
