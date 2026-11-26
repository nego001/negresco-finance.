import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {verify} from './verify_guardiao_lock_m119.mjs';
export function compare(manifest,original,candidate,before,after){
  verify(manifest,original);verify(manifest,candidate);
  if(before?.auditCompleted!==true||after?.auditCompleted!==true||before.approvedForProduction!==false||after.approvedForProduction!==false||before.stableReleaseAllowed!==false||after.stableReleaseAllowed!==false)throw Error('audit missing');
  const changes=[];
  const a=original.packages,b=candidate.packages;
  for(const path of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()){
    if(!path)continue;
    const old=a[path],next=b[path];
    if(old&&next&&old.version===next.version&&(old.integrity!==next.integrity||old.resolved!==next.resolved))throw Error('same-version provenance drift');
    if(old?.version!==next?.version)changes.push({path,before:old?.version??null,after:next?.version??null});
  }
  for(const name of Object.keys({...manifest.dependencies,...manifest.devDependencies})){
    const path='node_modules/'+name;
    if(a[path]?.version!==b[path]?.version)throw Error('direct resolved version drift');
  }
  const counts=x=>x.counts.high+x.counts.critical;
  const previous=new Map(before.findings.map(x=>[x.name,x.severity]));
  const ranks=['info','low','moderate','high','critical'];
  const regressions=after.findings.filter(x=>!previous.has(x.name)||ranks.indexOf(x.severity)>ranks.indexOf(previous.get(x.name)));
  const improved=counts(after)<counts(before)&&after.total<=before.total&&regressions.length===0;
  return {originalPackages:Object.keys(a).length-1,candidatePackages:Object.keys(b).length-1,changes,before:before.counts,after:after.counts,regressions,highOrCriticalReduced:counts(after)<counts(before),candidateEligible:improved&&counts(after)===0,approvedForProduction:false,stableReleaseAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==7)throw Error('args');
  const [manifest,original,candidate,before,after]=process.argv.slice(2).map(p=>JSON.parse(readFileSync(p,'utf8')));
  console.log(JSON.stringify(compare(manifest,original,candidate,before,after),null,2));
 }catch{console.error('BLOCK (LAB): candidate scope or audit evidence mismatch');process.exitCode=1}
}
