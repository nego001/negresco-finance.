import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {contained,state,original,patched,plan} from '../tooling/android/guardiao_portable_metro_m141.mjs';
test('M141 rejects traversal and sibling paths',()=>{const root=resolve('node_modules');assert.ok(contained(root,resolve(root,'metro/src/Assets.js')));assert.ok(!contained(root,root));assert.ok(!contained(root,resolve(root,'../node_modules-other/file')));assert.ok(!contained(root,resolve(root,'../App.tsx')))});
test('M141 accepts only exact original or adapted hash states',()=>{assert.equal(state(original),'original');assert.equal(state(patched),'patched');assert.throws(()=>state('0'.repeat(64)));assert.throws(()=>plan(Buffer.from('unknown'),'apply'));assert.throws(()=>plan(Buffer.from('unknown'),'verify'))});
