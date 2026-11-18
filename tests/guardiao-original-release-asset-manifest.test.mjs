import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,symlinkSync,linkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const tool='tooling/android/guardiao_original_release_asset_manifest_lab.py';
const source=readFileSync(tool,'utf8');
const sha='29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a';
const rel=assets=>[{assets}];
const asset=(digest,name='sample.apk')=>({name,digest});
function fixture(obj,fn){
 const dir=mkdtempSync(join(tmpdir(),'guardiao-metadata-'));
 try{const path=join(dir,'releases.json');writeFileSync(path,JSON.stringify(obj));fn(path,dir);}
 finally{rmSync(dir,{recursive:true,force:true});}
}
function run(path){
 const r=spawnSync('python3',[tool,path],{encoding:'utf8',timeout:20000});
 assert.doesNotMatch(r.stdout+r.stderr,/https?:\/\/|SECRET|PRIVATE|\/data\/app\/|releases\.json/);
 return {code:r.status,out:r.stdout.trim(),err:r.stderr.trim()};
}
test('23 nonmatching release APK SHA digests cannot substitute the old binary',()=>{
 const assets=Array.from({length:23},(_,i)=>asset('sha256:'+String(i+1).padStart(64,'0'),'sample-'+i+'.apk'));
 fixture(rel(assets),p=>assert.deepEqual(run(p),{code:0,out:'STATUS (LAB): original-apk-not-in-release-asset-metadata',err:''}));
});
test('matching digest stays metadata-only, never an APK identity PASS',()=>{
 fixture(rel([asset('sha256:'+sha)]),p=>assert.deepEqual(run(p),{code:0,out:'STATUS (LAB): candidate-asset-metadata-only-bytes-unverified',err:''}));
});
test('missing/malformed digests, duplicate identities and incomplete inventory fail closed',()=>{
 for(const x of [
   rel([asset(null)]),rel([asset('sha256:'+'z'.repeat(64))]),rel([asset('SHA256:'+sha)]),
   rel([asset('sha256:'+sha),asset('sha256:'+sha,'duplicate.apk')]),
   [],[{assets:[]}],[{notAssets:[]}],{artifacts:[]},rel([null]),rel([{name:3,digest:'sha256:'+sha}])
 ])fixture(x,p=>assert.deepEqual(run(p),{code:1,out:'BLOCK (LAB): release-asset-inventory-unconfirmed',err:''}));
});
test('symlink and hardlink inventory files cannot be trusted',()=>{
 fixture(rel([asset('sha256:'+sha)]),(p,d)=>{
  const alias=join(d,'alias.json');symlinkSync(p,alias);assert.equal(run(alias).code,1);rmSync(alias);
  linkSync(p,alias);assert.equal(run(alias).code,1);assert.equal(run(p).code,1);
 });
});
test('strict offline source never downloads, installs or approves executable bytes',()=>{
 for(const key of ['MAX_FILE = 3_000_000','MAX_ASSETS = 1200','os.O_NOFOLLOW','stat.S_ISREG','DIGEST.fullmatch(digest)','STATUS (LAB):'])assert.ok(source.includes(key),key);
 assert.ok(source.includes(sha));
 assert.doesNotMatch(source,/import (?:requests|urllib|socket|subprocess)|subprocess\.run|os\.system|print\(asset|print\(name|print\(digest/);
});
