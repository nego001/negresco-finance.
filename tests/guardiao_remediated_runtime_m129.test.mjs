import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from '../tooling/android/guardiao_metro_runtime_adapter_m129.mjs';
import {reconcile} from '../tooling/android/guardiao_runtime_prebuild_integrity_m129.mjs';
const w=readFileSync('.github/workflows/guardiao-remediated-runtime-m129.yml','utf8');
test('M129 pins exact eligible M128 artifact and adapter, with no release or write permissions',()=>{
 for(const s of ['run-id: 45733924181','cbb8bec52cb7d62a9959cd92bb195c943ade634794b0f634e3c1af2f182c78b3','3ea2b5f6792077da751938c13dbec55440c88b1fac9dde679df56f6e1683e7c0','api-level: 28','contents: read','actions: read','guardiao_debug_pdf_two_same_pid_lab.py','cmp package.json'])assert.ok(w.includes(s),s);
 assert.ok(!w.includes('assembleRelease')&&!w.includes('contents: write')&&!w.includes('upload-artifact'));
});
test('M129 prebuild integrity retains exact native print source selection',()=>{
 const p={scripts:{android:'expo start --android'},expo:{autolinking:{android:{buildFromSource:['expo-print']}}}};
 const q=structuredClone(p);q.scripts.android='expo run:android';assert.deepEqual(reconcile(p,q).changedScripts,['android']);q.expo.autolinking.android.buildFromSource.push('other');assert.throws(()=>reconcile(p,q));
});
