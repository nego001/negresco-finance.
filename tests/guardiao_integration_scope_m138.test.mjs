import test from 'node:test';
import assert from 'node:assert/strict';
import {expected,validate} from '../tooling/android/guardiao_integration_scope_m138.mjs';
test('M138 exact three application paths accepted independent of order',()=>assert.equal(validate([...expected].reverse().join('\0')+'\0'),3));
test('M138 rejects missing, duplicate, extra and malformed staged paths',()=>{for(const p of [expected.slice(1),[...expected,expected[0]],[...expected,'.github/workflows/ci.yml'],['apps/mobile/App.tsx','apps/mobile/package.json','apps/mobile/package-lock.json.bak']])assert.throws(()=>validate(p.join('\0')+'\0'));assert.throws(()=>validate(expected.join('\0')))});
