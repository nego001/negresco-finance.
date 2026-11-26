import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
const allowed={android:'expo run:android',ios:'expo run:ios'};
export function reconcile(before,after){
 if(!before||!after||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)||Array.isArray(after)||!before.scripts||!after.scripts||Array.isArray(before.scripts)||Array.isArray(after.scripts)||typeof before.scripts!=='object'||typeof after.scripts!=='object')throw Error('invalid manifest');
 const fields=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!isDeepStrictEqual(before[k],after[k]));
 if(fields.some(k=>k!=='scripts'))throw Error('unexpected manifest field');
 const changes=[...new Set([...Object.keys(before.scripts),...Object.keys(after.scripts)])].filter(k=>!isDeepStrictEqual(before.scripts[k],after.scripts[k]));
 for(const k of changes)if(!Object.hasOwn(allowed,k)||after.scripts[k]!==allowed[k])throw Error('unexpected script change');
 return {changedFields:fields,changedScripts:changes.sort(),dependencyFieldsUnchanged:true,approvedForProduction:false,stableReleaseAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==4||process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REF!=='refs/heads/lab/p01-guardiao-remediated-persistence-m130-v1')throw Error('scope');
  const before=JSON.parse(readFileSync(process.argv[2],'utf8')),after=JSON.parse(readFileSync(process.argv[3],'utf8'));
  console.log('Prebuild changed top-level keys: '+JSON.stringify([...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!isDeepStrictEqual(before[k],after[k]))));
  console.log('Prebuild changed script keys: '+JSON.stringify([...new Set([...Object.keys(before.scripts??{}),...Object.keys(after.scripts??{})])].filter(k=>!isDeepStrictEqual(before.scripts?.[k],after.scripts?.[k]))));
  console.log(JSON.stringify(reconcile(before,after)));
 }catch{console.error('BLOCK (LAB): prebuild manifest change outside allowlist');process.exitCode=1}
}
