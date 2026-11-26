import {readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const anchor=/const isImageInput = assetInfo\.files\[0\]\.includes\((["'])\.zip\/\1\)\s*\?\s*((?:_fs\.default|fs)\.readFileSync\(assetInfo\.files\[0\]\))\s*:\s*assetInfo\.files\[0\];/g;
const hash=s=>createHash('sha256').update(s).digest('hex');
export function transform(source){
 const matches=[...source.matchAll(anchor)];
 if(matches.length!==1||!source.includes('isImage ?')||!source.includes('(isImageInput)')||source.includes('NEGRESCO_M127_BUFFER_ADAPTER'))throw Error('Metro source anchor mismatch');
 const [original,,read]=matches[0];
 return source.replace(original,'/* NEGRESCO_M127_BUFFER_ADAPTER */\n  const isImageInput = isImage ? '+read+' : null;');
}
function paths(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REF!=='refs/heads/lab/p01-guardiao-metro-compat-m127-v1')throw Error('scope');
 const app=resolve('package.json'),require=createRequire(app);
 const metro=require.resolve('metro/package.json');
 if(JSON.parse(readFileSync(metro,'utf8')).version!=='0.83.3')throw Error('Metro version');
 const metroRequire=createRequire(metro);
 const imageEntry=metroRequire.resolve('image-size');
 const imageRoot=resolve(dirname(imageEntry),'../..');
 if(JSON.parse(readFileSync(join(imageRoot,'package.json'),'utf8')).version!=='2.0.3')throw Error('image version');
 const file=join(dirname(metro),'src','Assets.js');
 if(!lstatSync(file).isFile()||realpathSync(file)!==resolve(file)||!file.startsWith(resolve('node_modules')+'/'))throw Error('unsafe path');
 return file;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const file=paths(),source=readFileSync(file,'utf8');
  const state=join(process.env.RUNNER_TEMP,'m127-metro-assets.sha256');
  if(process.argv[2]==='apply'){
   const output=transform(source);
   writeFileSync(file,output,'utf8');
   writeFileSync(state,hash(output)+'\n',{flag:'wx'});
   console.log('PASS (LAB): Metro exact buffer adapter before='+hash(source)+' after='+hash(output));
  }else if(process.argv[2]==='verify'){
   if(!source.includes('NEGRESCO_M127_BUFFER_ADAPTER')||hash(source)!==readFileSync(state,'utf8').trim())throw Error('adapter drift');
   console.log('PASS (LAB): Metro buffer adapter unchanged');
  }else throw Error('args');
 }catch{console.error('BLOCK (LAB): Metro adapter scope or source not verified');process.exitCode=1}
}
