import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {run as adapter} from './guardiao_portable_metro_m141.mjs';
import {reconcile} from './guardiao_moderate_prebuild_integrity_m137.mjs';
import stable from './verify_stable_npm_lock.cjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyBytes(manifest,lock){
 assert.equal(sha(manifest),'61bf3916e30b74d248040f236fcb1e9a36e484aadb2331a461509c206849becd');
 assert.equal(sha(lock),'f66d6fd261dea4c82332bf0499058a039774da9dcaa77a6e3c30934e702a7c28');
}
function regular(p){assert.ok(lstatSync(p).isFile());assert.equal(realpathSync(p),resolve(p));return readFileSync(p)}
function check(){
 assert.equal(execFileSync('git',['ls-files','--error-unmatch','package-lock.json'],{encoding:'utf8'}).trim(),'package-lock.json');
 const manifest=regular('package.json'),lock=regular('package-lock.json');
 verifyBytes(manifest,lock);
 assert.equal(stable.verify('package.json','package-lock.json'),762);
 return {manifest,lock};
}
export function command(mode){
 assert.ok(process.platform==='linux','CI helper is Linux-only; portable adapter is separately Windows-tested');
 assert.ok(process.env.GITHUB_ACTIONS==='true','CI scope required');
 assert.ok(['install','prebuild','verify'].includes(mode));
 const {manifest,lock}=check();
 if(mode==='install'){
  execFileSync('npm',['ci','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org/'],{stdio:'inherit'});
  check();adapter(process.cwd(),'apply');
 }else if(mode==='prebuild'){
  adapter(process.cwd(),'verify');
  execFileSync('./node_modules/.bin/expo',['prebuild','--platform','android','--non-interactive','--no-install'],{stdio:'inherit',env:{...process.env,CI:'1'}});
  assert.ok(regular('package-lock.json').equals(lock),'prebuild changed lock bytes');
  console.log(JSON.stringify(reconcile(JSON.parse(manifest),JSON.parse(regular('package.json')))));
  writeFileSync('package.json',manifest);
 }
 check();adapter(process.cwd(),'verify');
 console.log('PASS (LAB): exact reviewed mobile dependency state and Metro adapter');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{assert.equal(process.argv.length,3);command(process.argv[2])}catch(e){console.error('BLOCK: reviewed CI mobile setup failed: '+e.message);process.exitCode=1}
}
