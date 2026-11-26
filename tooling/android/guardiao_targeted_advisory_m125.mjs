import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
export function plan(lock,report,target,versions,semver){
  const name=target.name;
  const packages=lock.packages;
  const installed=packages['node_modules/'+name];
  const parent=packages[target.parent];
  const required=parent?.dependencies?.[name];
  const finding=report.vulnerabilities?.[name];
  if(!installed||!required||!semver.validRange(required)||!semver.valid(installed.version)||!finding||finding.name!==name||!['high','critical'].includes(finding.severity)||!Array.isArray(finding.via)||!Array.isArray(finding.nodes)||finding.nodes.length!==1||finding.nodes[0]!=='node_modules/'+name)throw Error('target evidence changed');
  const advisories=finding.via.filter(v=>typeof v==='object'&&v!==null);
  if(!advisories.length||advisories.length!==finding.via.length||advisories.some(v=>v.name!==name||!semver.validRange(v.range)||!Number.isInteger(v.source)))throw Error('advisory evidence ambiguous');
  if(!advisories.some(v=>semver.satisfies(installed.version,v.range)))throw Error('installed vulnerability mismatch');
  if(!Array.isArray(versions)||versions.some(v=>!semver.valid(v)))throw Error('invalid registry versions');
  const safe=versions.filter(v=>!semver.prerelease(v)&&semver.gt(v,installed.version)&&advisories.every(a=>!semver.satisfies(v,a.range))).sort(semver.compare);
  const compatible=safe.filter(v=>semver.satisfies(v,required));
  const sameMajor=safe.filter(v=>semver.major(v)===semver.major(installed.version));
  return {name,installed:installed.version,parent:target.parent,parentVersion:parent.version,required,advisories:advisories.map(a=>({source:a.source,range:a.range,severity:a.severity})),compatibleCandidate:compatible[0]??null,sameMajorOutsideRange:sameMajor.find(v=>!semver.satisfies(v,required))??null,firstOutsideRange:safe.find(v=>!semver.satisfies(v,required))??null,classification:compatible.length?'IN_RANGE_CANDIDATE':'PARENT_UPDATE_OR_REVIEW_REQUIRED',approvedForProduction:false};
}
export const targets=[{name:'image-size',parent:'node_modules/metro'},{name:'postcss',parent:'node_modules/expo/node_modules/@expo/metro-config'}];
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==7)throw Error('args');
  const [lock,report,imageVersions,postcssVersions]=process.argv.slice(2,6).map(p=>JSON.parse(readFileSync(p,'utf8')));
  const semver=createRequire(process.argv[6])('semver');
  console.log(JSON.stringify({targets:targets.map((t,i)=>plan(lock,report,t,[imageVersions,postcssVersions][i],semver)),approvedForProduction:false,stableReleaseAllowed:false},null,2));
 }catch{console.error('BLOCK (LAB): focused advisory evidence unavailable or changed');process.exitCode=1}
}
