import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {compare} from './guardiao_audit_remediation_m124.mjs';
export const overrides={'metro@0.83.3':{'image-size':'2.0.3'},'@expo/metro-config@54.0.17':{'postcss':'8.5.23'}};
const allowed=new Set(['image-size','postcss','queue','nanoid','picocolors','source-map-js']);
const leaf=p=>p.slice(p.lastIndexOf('node_modules/')+13);
export function gate(manifest,original,candidate,before,after){
 const result=compare(manifest,original,candidate,before,after);
 const outOfScope=result.changes.filter(x=>!allowed.has(leaf(x.path)));
 const bounded=result.changes.length<=12&&outOfScope.length===0;
 const targets=Object.entries(candidate.packages).filter(([p])=>['image-size','postcss'].includes(leaf(p)));
 const exact=targets.some(([p,v])=>leaf(p)==='image-size'&&v.version==='2.0.3')&&targets.some(([p,v])=>leaf(p)==='postcss'&&v.version==='8.5.23')&&targets.every(([p,v])=>v.version===(leaf(p)==='image-size'?'2.0.3':'8.5.23'));
 return {...result,bounded,outOfScope,exactTargetVersions:exact,candidateEligible:result.candidateEligible&&bounded&&exact,approvedForProduction:false,stableReleaseAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==7)throw Error('args');
  const args=process.argv.slice(2).map(p=>JSON.parse(readFileSync(p,'utf8')));
  console.log(JSON.stringify(gate(...args),null,2));
 }catch{console.error('BLOCK (LAB): targeted candidate scope mismatch');process.exitCode=1}
}
