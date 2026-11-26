import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {compare} from './guardiao_audit_remediation_m124.mjs';
import {overrides as baseline} from './guardiao_targeted_overrides_m126.mjs';
// Nest minimatch under each affected glob edge; never use a top-level glob child override.
const correctedGlob=()=>({'.':'14.0.2',minimatch:'11.0.9'});
export const overrides={...baseline,
 '@expo/config@12.0.14':{glob:correctedGlob()},
 '@expo/config-plugins@54.0.6':{glob:correctedGlob()},
 '@expo/fingerprint@0.15.5':{glob:correctedGlob(),minimatch:'11.0.9'},
 'expo-updates':{'.':'$expo-updates',glob:correctedGlob()},
 '@expo/cli@54.0.28':{glob:correctedGlob(),minimatch:'11.0.9'},
 '@expo/metro-config@54.0.17':{...baseline['@expo/metro-config@54.0.17'],glob:correctedGlob()},
 'rimraf@3.0.2':{glob:{'.':'7.2.3',minimatch:{'.':'3.1.5','brace-expansion':{'.':'1.1.22','balanced-match':'1.0.2'}}}}
};
const leaf=p=>p.slice(p.lastIndexOf('node_modules/')+13);
const allowed=new Set(['glob','minimatch','brace-expansion','balanced-match','minipass','path-scurry','lru-cache','foreground-child','jackspeak','package-json-from-dist','@isaacs/cliui','@isaacs/brace-expansion','@isaacs/balanced-match','@isaacs/nonrecursive-glob-match']);
export function gate(manifest,original,candidate,before,after){
 const result=compare(manifest,original,candidate,before,after);
 const outOfScope=result.changes.filter(x=>!allowed.has(leaf(x.path)));
 const legacy=Object.entries(original.packages).filter(([p,v])=>leaf(p)==='glob'&&v.version.startsWith('7.')||leaf(p)==='minimatch'&&v.version.startsWith('3.'));
 const legacyPreserved=legacy.every(([p,v])=>candidate.packages[p]?.version===v.version&&candidate.packages[p]?.integrity===v.integrity);
 const has=(n,v)=>Object.entries(candidate.packages).some(([p,e])=>leaf(p)===n&&e.version===v);
 const noAffectedCopies=Object.entries(candidate.packages).every(([p,e])=>leaf(p)!=='glob'||e.version.startsWith('7.')||e.version==='14.0.2')&&Object.entries(candidate.packages).every(([p,e])=>leaf(p)!=='minimatch'||e.version.startsWith('3.')||e.version==='11.0.9');
 const targetVersions=noAffectedCopies&&has('glob','14.0.2')&&has('minimatch','11.0.9')&&has('image-size','2.0.3')&&has('postcss','8.5.23');
 const eligible=before.total>0&&after.total===0&&result.regressions.length===0&&result.changes.length<=32&&outOfScope.length===0&&legacyPreserved&&targetVersions;
 return {...result,outOfScope,legacyPreserved,targetVersions,candidateEligible:eligible,approvedForProduction:false,stableReleaseAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==7)throw Error('args');
  console.log(JSON.stringify(gate(...process.argv.slice(2).map(p=>JSON.parse(readFileSync(p,'utf8')))),null,2));
 }catch{console.error('BLOCK (LAB): moderate candidate evidence inconsistent');process.exitCode=1}
}
