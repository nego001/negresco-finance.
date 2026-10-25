import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const script=resolve('tooling/android/verify_stable_npm_lock.cjs');
const {verify,parseUniqueJson}=require(script);
const name='@negresco/mobile';
const digest='sha512-'+Buffer.alloc(64,7).toString('base64');
const manifest={name,version:'3.1.3',private:true,
  dependencies:{expo:'~54.0.0','expo-updates':'~29.0.0'},
  devDependencies:{typescript:'~5.9.2'}};
function record(packageName,version='1.2.3'){
  return {version,resolved:'https://registry.npmjs.org/'+packageName+'/-/'+packageName.split('/').pop()+'-'+version+'.tgz',integrity:digest};
}
function lock(){
  return {name,version:'3.1.3',lockfileVersion:3,requires:true,packages:{
    '':{name,version:'3.1.3',dependencies:{...manifest.dependencies},devDependencies:{...manifest.devDependencies}},
    'node_modules/expo':record('expo','54.0.7'),
    'node_modules/expo-updates':record('expo-updates','29.0.3'),
    'node_modules/typescript':record('typescript','5.9.2'),
    'node_modules/expo/node_modules/cross-spawn':record('cross-spawn','7.0.6')
  }};
}
function fixture(t,edit,opts={}){
  const folder=mkdtempSync(join(tmpdir(),'negresco-npm-lock-gate-'));
  t.after(()=>rmSync(folder,{recursive:true,force:true}));
  const packageFile=join(folder,'package.json'),lockFile=join(folder,'package-lock.json');
  const p=structuredClone(manifest),l=lock();
  edit?.(p,l);
  writeFileSync(packageFile,opts.rawManifest??JSON.stringify(p));
  if(!opts.noLock)writeFileSync(lockFile,opts.rawLock??JSON.stringify(l));
  return {folder,packageFile,lockFile};
}
function allow(f){
  assert.equal(verify(f.packageFile,f.lockFile),4);
  const r=spawnSync('node',[script,f.packageFile,f.lockFile],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/PASS: stable mobile dependency lock v3/);
}
function reject(f,pattern){
  assert.throws(()=>verify(f.packageFile,f.lockFile),pattern);
  const r=spawnSync('node',[script,f.packageFile,f.lockFile],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,1,r.stdout+r.stderr);
  assert.match(r.stderr,pattern);
}
test('canonical npm v3 lock admits reviewed SHA-512 dependency graph',t=>allow(fixture(t)));
test('missing lock blocks stable publishing while preview remains testable',t=>{
  reject(fixture(t,undefined,{noLock:true}),/missing, linked, nonregular or oversized package-lock\.json/);
  assert.equal(existsSync(resolve('apps/mobile/package-lock.json')),false);
});
test('reject lockfile v2, mismatched package or mismatched root',t=>{
  for(const change of [
    (_,l)=>l.lockfileVersion=2,(_,l)=>l.name='another',
    (_,l)=>l.version='9.0.0',(_,l)=>l.packages[''].version='0.0.0'
  ])reject(fixture(t,change),/lockfile or package identity mismatch|root identity mismatch/);
});
test('reject direct/development dependency drift',t=>{
  for(const change of [
    p=>p.dependencies.expo='~54.2.0',
    p=>p.devDependencies.typescript='^5.9.2',
    (_,l)=>delete l.packages[''].dependencies['expo-updates'],
    (_,l)=>l.packages[''].devDependencies.typescript='*'
  ])reject(fixture(t,change),/root dependencies differs|root devDependencies differs/);
});
test('reject missing direct lock record',t=>{
  reject(fixture(t,(_,l)=>delete l.packages['node_modules/expo']),/missing direct dependency lock record/);
});
test('reject malicious, unencrypted, local, Git or alternate-registry resolutions',t=>{
  for(const resolved of [
    'http://registry.npmjs.org/expo/-/expo-54.0.7.tgz',
    'https://registry.npmjs.org.evil.test/expo-54.0.7.tgz',
    'https://evil.test/expo.tgz','git+ssh://git@github.com/user/repo.git',
    'file:../unexpected','https://user:pass@registry.npmjs.org/expo.tgz',
    'https://registry.npmjs.org:444/expo.tgz'
  ])reject(fixture(t,(_,l)=>{l.packages['node_modules/expo'].resolved=resolved;}),/not pinned to trusted HTTPS registry|invalid npm resolved URL/);
});
test('reject missing, SHA-1, truncated or invalid integrity',t=>{
  for(const integrity of [undefined,'sha1-aabbcc','sha512-aabb',digest.slice(0,-1)])
    reject(fixture(t,(_,l)=>{l.packages['node_modules/expo'].integrity=integrity;}),/missing SHA-512 integrity/);
});
test('reject links, bundled and path-traversal dependency records',t=>{
  reject(fixture(t,(_,l)=>{l.packages['node_modules/expo'].link=true;}),/unsafe lock package record/);
  reject(fixture(t,(_,l)=>{l.packages['node_modules/expo'].inBundle=true;}),/unsafe lock package record/);
  reject(fixture(t,(_,l)=>{l.packages['node_modules/../malicious']=record('malicious');}),/invalid lock package path/);
});
test('reject duplicate JSON keys including escape-equivalent names',t=>{
  const f=fixture(t);
  const dup=readFileSync(f.lockFile,'utf8').replace('"lockfileVersion":3','"lockfileVersion":3,"lockfileVersion":3');
  writeFileSync(f.lockFile,dup);reject(f,/duplicate JSON key/);
  assert.throws(()=>parseUniqueJson('{"key":1,"key":2}'),/duplicate JSON key/);
  assert.throws(()=>parseUniqueJson('{"\\u006bey":1,"key":2}'),/duplicate JSON key/);
});
test('reject symlinked npm lockfiles',t=>{
  const f=fixture(t),link=join(f.folder,'linked.json');
  symlinkSync(f.lockFile,link);
  reject({...f,lockFile:link},/missing, linked, nonregular or oversized linked\.json/);
});
test('reject oversized and incomplete lockfile JSON',t=>{
  const large=fixture(t);writeFileSync(large.lockFile,' '.repeat(8*1024*1024+1));
  reject(large,/oversized package-lock\.json/);
  reject(fixture(t,undefined,{rawLock:'{"lockfileVersion":3,'}),/cannot parse package-lock\.json/);
});
test('workflow has stable-only npm ci with mandatory lock verification',()=>{
  const wf=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
  const first=wf.indexOf('      - name: Require reviewed npm lockfile before any stable Android candidate');
  const lab=wf.indexOf('      - name: Install JS dependencies');
  const stable=wf.indexOf('      - name: Install reviewed stable JS dependencies without resolving changes');
  const build=wf.indexOf('      - name: Build standalone test APK');
  assert.ok(first>0&&first<lab&&lab<stable&&stable<build);
  const cond="github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && (inputs.publish_release || inputs.stable_signing)";
  assert.ok(wf.includes('if: $'+'{{ '+cond+' }}'));
  assert.ok(wf.includes('if: $'+'{{ !('+cond+') }}'));
  assert.match(wf,/node \.\.\/\.\.\/tooling\/android\/verify_stable_npm_lock\.cjs package\.json package-lock\.json/);
  assert.match(wf,/run: npm ci --no-audit --no-fund/);
  assert.match(wf,/run: npm install --no-audit --no-fund/);
  assert.match(wf,/tests\/android-stable-npm-lock-gate\.test\.mjs/);
  assert.ok(first<wf.indexOf('NEGRESCO_RELEASE_KEYSTORE_B64'));
});
