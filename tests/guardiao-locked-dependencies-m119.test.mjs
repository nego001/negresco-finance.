import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {verify} from '../tooling/android/verify_guardiao_lock_m119.mjs';
const manifest={name:'@negresco/mobile',version:'3.1.3',dependencies:{'react-native-safe-area-context':'5.6.0'}};
const make=()=>({name:manifest.name,version:manifest.version,lockfileVersion:3,packages:{'':{...manifest},'node_modules/react-native-safe-area-context':{version:'5.6.0',resolved:'https://registry.npmjs.org/react-native-safe-area-context/-/react-native-safe-area-context-5.6.0.tgz',integrity:'sha512-YWJjZA=='}}});
test('M119 exact candidate lock policy and integrity',()=>{
 assert.equal(verify(manifest,make()),1);
 const l=make();l.packages['node_modules/react-native-safe-area-context'].version='5.6.1';assert.throws(()=>verify(manifest,l));
 const wrong=make();wrong.packages[''].dependencies={};assert.throws(()=>verify(manifest,wrong));
});
test('M119 rejects nonpublic URLs, missing integrity and link entries',()=>{
 for(const changes of [{resolved:'https://registry.npmjs.org.evil/a.tgz'},{resolved:'https://user:pass@registry.npmjs.org/a.tgz'},{resolved:'file:local.tgz'},{integrity:''},{link:true}]){
  const l=make();Object.assign(l.packages['node_modules/react-native-safe-area-context'],changes);assert.throws(()=>verify(manifest,l));
 }
});
test('M119 rejects main and preserves original M117 scope',()=>{
 const r=spawnSync('python3',['-c',[
 'import os,sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_locked_dependencies_m119 as m',
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF="refs/heads/main")',
 'assert not m.scope()',
 'try: m.apply(); raise AssertionError("must reject")',
 'except RuntimeError: pass'].join('\n')],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
});
test('M119 bounded metadata-only workflow and blocked production',()=>{
 const w=readFileSync('.github/workflows/guardiao-locked-dependencies-m119.yml','utf8');
 for(const x of ['npm install --package-lock-only --ignore-scripts','npm ci --ignore-scripts','sha256sum -c','./node_modules/.bin/tsc --noEmit','path: apps/mobile/package-lock.json','persist-credentials: false','contents: read'])assert.ok(w.includes(x),x);
 assert.ok(!w.includes('assembleRelease')&&!w.includes('assembleDebug'));
 const d=readFileSync('docs/security/P0_GUARDIAO_LOCKED_DEPENDENCIES_M119.md','utf8');
 for(const x of ['2/2 independently verified PDFs','1870/1870','No APK','approvedForProduction=false','stableReleaseAllowed=false','#120/#126'])assert.ok(d.includes(x),x);
});
