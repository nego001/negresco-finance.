import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcile} from '../tooling/android/guardiao_prebuild_integrity_m128.mjs';
const before=()=>({name:'@negresco/mobile',scripts:{start:'expo start',android:'expo start --android',web:'expo start --web'},dependencies:{expo:'~54.0.0'},overrides:{metro:{'image-size':'2.0.3'}}});
test('M128 allows only expected Expo native run scripts and unchanged metadata',()=>{const a=before(),b=structuredClone(a);b.scripts.android='expo run:android';b.scripts.ios='expo run:ios';assert.deepEqual(reconcile(a,b).changedScripts,['android','ios']);assert.equal(reconcile(a,b).approvedForProduction,false);assert.deepEqual(reconcile(a,a).changedScripts,[])});
test('M128 rejects dependency or override changes even with expected scripts',()=>{for(const field of ['dependencies','overrides','devDependencies','main']){const a=before(),b=structuredClone(a);b.scripts.android='expo run:android';b[field]={unexpected:'1.0.0'};assert.throws(()=>reconcile(a,b))}});
test('M128 rejects any unrelated script addition, replacement or deletion',()=>{for(const change of [b=>b.scripts.postinstall='node x',b=>delete b.scripts.start,b=>b.scripts.android='other',b=>b.scripts.web='other']){const a=before(),b=structuredClone(a);change(b);assert.throws(()=>reconcile(a,b))}});
