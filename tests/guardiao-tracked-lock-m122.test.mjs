import {originalManifest,verifyActiveDependencyState} from './helpers/guardiao_dependency_state_m143.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verify} from '../tooling/android/verify_guardiao_lock_m119.mjs';
const path='tooling/android/fixtures/guardiao-mobile-m119-package-lock.json';
const raw=readFileSync(path);
const lock=JSON.parse(raw);
test('M122 tracked candidate exactly matches the homologated M119/M120 bytes',()=>{
 assert.equal(raw.length,353587);
 assert.equal(createHash('sha256').update(raw).digest('hex'),'a31326388567fffdfccbe8ec08326fe089356a55f9058c5b669c70a28e579f27');
 assert.equal(Object.keys(lock.packages).length,749);
});
test('M122 candidate lock agrees with original manifest plus isolated safe area pin',()=>{
 const manifest=originalManifest();
 verifyActiveDependencyState();
 assert.ok(!Object.hasOwn(manifest.dependencies,'react-native-safe-area-context'));
 manifest.dependencies['react-native-safe-area-context']='5.6.0';
 assert.equal(verify(manifest,lock),748);
});
