import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {analyze} from './guardiao_moderate_root_m131.mjs';
export function plan(graph,versions,semver){
 if(graph.counts.high||graph.counts.critical||graph.rootFindings.map(x=>x.name).sort().join(',')!=='glob,minimatch')throw Error('unexpected audit roots');
 return graph.rootFindings.map(root=>{
  if(!root.nodes.length||!root.parents.length||!root.advisories.length||root.advisories.some(a=>!semver.validRange(a.range)))throw Error('incomplete root');
  const available=versions[root.name];
  if(!Array.isArray(available)||available.some(v=>!semver.valid(v)))throw Error('invalid registry versions');
  const safe=available.filter(v=>!semver.prerelease(v)&&root.nodes.every(n=>semver.gt(v,n.version))&&root.advisories.every(a=>!semver.satisfies(v,a.range))).sort(semver.compare);
  const parents=root.parents.map(p=>{
   if(!semver.validRange(p.range))throw Error('invalid parent range');
   return {...p,compatible:safe.find(v=>semver.satisfies(v,p.range))??null};
  });
  return {name:root.name,installed:root.nodes,firstNonaffected:safe[0]??null,parents,commonInRange:safe.find(v=>parents.every(p=>semver.satisfies(v,p.range)))??null,requiresCompatibilityReview:parents.some(p=>!p.compatible),approvedForProduction:false};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==8||!['0','1'].includes(process.argv[7]))throw Error('args');
  const [lock,report,glob,minimatch]=process.argv.slice(2,6).map(p=>JSON.parse(readFileSync(p,'utf8')));
  const semver=createRequire(process.argv[6])('semver');
  const graph=analyze(lock,report,Number(process.argv[7]));
  console.log(JSON.stringify({targets:plan(graph,{glob,minimatch},semver),approvedForProduction:false,stableReleaseAllowed:false},null,2));
 }catch{console.error('BLOCK (LAB): moderate compatibility plan evidence inconsistent');process.exitCode=1}
}
