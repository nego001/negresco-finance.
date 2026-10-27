import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {gitBlob}=require('../tooling/android/node_forge_141_provenance.cjs');
test('Git blob hashing exact known input',()=>assert.equal(gitBlob(Buffer.from('hello\n')),'ce013625030ba8dba906f756967f9e9ca394464a'));
test('provenance lab has independent npm ci and no release operations',()=>{
 const w=readFileSync('.github/workflows/node-forge-141-provenance-lab.yml','utf8');
 assert.match(w,/lab\/p01-node-forge-141-provenance-v1/);
 assert.match(w,/  capture:/);assert.match(w,/  verify:/);
 assert.equal((w.match(/npm ci --ignore-scripts --no-audit --no-fund/g)||[]).length,2);
 assert.equal((w.match(/npm audit --json --package-lock-only/g)||[]).length,2);
 assert.match(w,/node_forge_141_provenance\.cjs verify/);
 assert.doesNotMatch(w,/contents: write|eas update|gh release|gradlew assemble/);
});
