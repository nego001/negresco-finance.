import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classify,originalManifest,verifyActiveDependencyState} from './helpers/guardiao_dependency_state_m143.mjs';
const original=readFileSync('tooling/android/fixtures/m139-historical-baseline/package.json');
test('M143 validates active dependency state and immutable historical manifest',()=>{assert.equal(originalManifest().overrides,undefined);assert.ok(['historical','reviewed-lab-candidate'].includes(verifyActiveDependencyState()))});
test('M143 rejects modified unlocked manifest and unapproved lockfiles',()=>{assert.equal(classify(original,null,original),'historical');assert.throws(()=>classify(Buffer.concat([original,Buffer.from(' ')]),null,original));assert.throws(()=>classify(original,Buffer.from('{}'),original));assert.throws(()=>classify(original,readFileSync('tooling/android/fixtures/guardiao-mobile-m135-package-lock.json'),original))});
