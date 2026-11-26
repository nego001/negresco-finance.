import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const original=JSON.parse(readFileSync('tooling/android/fixtures/guardiao-mobile-m119-package-lock.json','utf8'));
const bytes=readFileSync('tooling/android/fixtures/guardiao-mobile-m128-package-lock.json');
const candidate=JSON.parse(bytes);
test('M130 tracked candidate equals exact M128 artifact lock bytes',()=>{assert.equal(bytes.length,353192);assert.equal(createHash('sha256').update(bytes).digest('hex'),'cbb8bec52cb7d62a9959cd92bb195c943ade634794b0f634e3c1af2f182c78b3');assert.equal(Object.keys(candidate.packages).length,748)});
test('M130 only three package records changed and direct dependencies remain unchanged',()=>{
 const changes=[...new Set([...Object.keys(original.packages),...Object.keys(candidate.packages)])].filter(k=>JSON.stringify(original.packages[k])!==JSON.stringify(candidate.packages[k])).sort();
 assert.deepEqual(changes,['node_modules/image-size','node_modules/postcss','node_modules/queue']);
 assert.equal(candidate.packages['node_modules/image-size'].version,'2.0.3');
 assert.equal(candidate.packages['node_modules/postcss'].version,'8.5.23');
 assert.ok(!Object.hasOwn(candidate.packages,'node_modules/queue'));
 assert.deepEqual(candidate.packages[''],original.packages['']);
});
