import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const canonical = obj => JSON.stringify(Object.entries(obj ?? {}).sort(([a],[b])=>a.localeCompare(b)));
export function verify(manifest,lock){
  if (manifest?.name !== '@negresco/mobile' || manifest?.dependencies?.['react-native-safe-area-context'] !== '5.6.0') throw Error('candidate-manifest');
  if (lock?.lockfileVersion !== 3 || !lock.packages || lock.name !== manifest.name || lock.version !== manifest.version) throw Error('lock-schema');
  const root=lock.packages[''];
  if (!root || root.name!==manifest.name || root.version!==manifest.version) throw Error('lock-root');
  for(const field of ['dependencies','devDependencies','optionalDependencies','peerDependencies']){
    if(canonical(root[field])!==canonical(manifest[field]))throw Error('root-dependency-mismatch');
  }
  let count=0;
  for(const [name,p] of Object.entries(lock.packages)){
    if(name==='')continue;
    if(!name.startsWith('node_modules/')||name.split('/').includes('..')||!p||typeof p.version!=='string'||p.link||typeof p.resolved!=='string'||typeof p.integrity!=='string')throw Error('unattested-package');
    const u=new URL(p.resolved);
    if(u.protocol!=='https:'||u.hostname!=='registry.npmjs.org'||u.port||u.username||u.password||u.search||u.hash||!u.pathname.endsWith('.tgz'))throw Error('nonpublic-registry');
    if(!/^sha(?:512|384|256|1)-[A-Za-z0-9+/]+={0,2}$/.test(p.integrity))throw Error('unattested-integrity');
    count++;
  }
  for(const name of Object.keys({...manifest.dependencies,...manifest.devDependencies})){
    if(!Object.hasOwn(lock.packages,'node_modules/'+name))throw Error('missing-direct-dependency');
  }
  if(lock.packages['node_modules/react-native-safe-area-context']?.version!=='5.6.0'||count===0)throw Error('safe-area-lock-mismatch');
  return count;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4)throw Error('arguments');
    const raw=readFileSync(process.argv[3]);
    if(raw.length>8*1024*1024)throw Error('lock-size');
    const count=verify(JSON.parse(readFileSync(process.argv[2],'utf8')),JSON.parse(raw));
    console.log('PASS (LAB): M119 public registry lock packages='+count+' sha256='+createHash('sha256').update(raw).digest('hex'));
  }catch{
    console.error('BLOCK (LAB): M119 lockfile policy unconfirmed');
    process.exitCode=1;
  }
}
