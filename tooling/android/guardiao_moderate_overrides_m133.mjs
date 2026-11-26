import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {compare} from './guardiao_audit_remediation_m124.mjs';
import {overrides as baseline} from './guardiao_targeted_overrides_m126.mjs';
export const overrides={...baseline,'glob@13.0.7':'14.0.2','minimatch@9.0.9':'11.0.1','minimatch@10.2.6':'11.0.1'};
const leaf=p=>p.slice(p.lastIndexOf('node_modules/')+13);
const allowed=new Set(['glob','minimatch','brace-expansion','balanced-match','minipass','path-scurry','lru-cache','foreground-child','jackspeak','package-json-from-dist','@isaacs/cliui','@isaacs/brace-expansion','@isaacs/balanced-match']);
export function gate(manifest,original,candidate,before,after){
 const result=compare(manifest,original,candidate,before,after);
 const outOfScope=result.changes.filter(x=>!allowed.has(leaf(x.path)));
 const legacy=Object.entries(original.packages).filter(([p,v])=>leaf(p)==='glob'&&v.version.startsWith('7.')||leaf(p)==='minimatch'&&v.version.startsWith('3.'));
 const legacyPreserved=legacy.every(([p,v])=>candidate.packages[p]?.version===v.version&&candidate.packages[p]?.integrity===v.integrity);
 const has=(n,v)=>Object.entries(candidate.packages).some(([p,e])=>leaf(p)===n&&e.version===v);
 const targetVersions=has('glob','14.0.2')&&has('minimatch','11.0.1')&&has('image-size','2.0.3')&&has('postcss','8.5.23');
 const eligible=before.total>0&&after.total===0&&result.regressions.length===0&&result.changes.length<=24&&outOfScope.length===0&&legacyPreserved&&targetVersions;
 return {...result,outOfScope,legacyPreserved,targetVersions,candidateEligible:eligible,approvedForProduction:false,stableReleaseAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==7)throw Error('args');
  console.log(JSON.stringify(gate(...process.argv.slice(2).map(p=>JSON.parse(readFileSync(p,'utf8')))),null,2));
 }catch{console.error('BLOCK (LAB): moderate candidate evidence inconsistent');process.exitCode=1}
}
