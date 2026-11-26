import assert from 'node:assert/strict';
import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verify} from '../../tooling/android/verify_guardiao_lock_m119.mjs';
const historicalPath='tooling/android/fixtures/m139-historical-baseline/package.json';
const manifestHash='61bf3916e30b74d248040f236fcb1e9a36e484aadb2331a461509c206849becd';
const lockHash='f66d6fd261dea4c82332bf0499058a039774da9dcaa77a6e3c30934e702a7c28';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function originalManifest(){
 const b=readFileSync(historicalPath);
 assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),'ecdd653eabeadeee8719b329fa725d89fb33842e');
 return JSON.parse(b);
}
export function classify(manifest,lock,original){
 if(lock===null){assert.ok(manifest.equals(original),'unlocked manifest must be exact historical bytes');return 'historical'}
 assert.equal(hash(manifest),manifestHash);
 assert.equal(hash(lock),lockHash);
 assert.equal(verify(JSON.parse(manifest),JSON.parse(lock)),762);
 return 'reviewed-lab-candidate';
}
export function verifyActiveDependencyState(){
 originalManifest();
 const manifest='apps/mobile/package.json',lock='apps/mobile/package-lock.json';
 assert.ok(lstatSync(manifest).isFile());
 let bytes=null;
 if(existsSync(lock)){assert.ok(lstatSync(lock).isFile());bytes=readFileSync(lock)}
 return classify(readFileSync(manifest),bytes,readFileSync(historicalPath));
}
