import test from 'node:test';
import assert from 'node:assert/strict';
import {compare} from '../tooling/android/guardiao_contract_evidence_m142.mjs';
const make=flags=>({totals:{tests:flags.length,fail:flags.filter(x=>!x).length},cases:flags.map((pass,i)=>({name:'test '+i,pass,location:pass?null:'tests/example.test.mjs:'+(i+1)+':1',code:pass?null:'ERR_ASSERTION',operator:null}))});
test('M142 distinguishes baseline, shared and candidate-only failures without approval',()=>{const x=compare(make([false,false,true,true]),make([true,false,false,true]));assert.equal(x.baselineOnly.length,1);assert.equal(x.both.length,1);assert.equal(x.candidateOnly.length,1);assert.equal(x.baselineValid,false);assert.equal(x.integrationApproved,false);assert.equal(x.affectedFiles,1)});
test('M142 approval requires both full inventories passing',()=>{assert.equal(compare(make([true]),make([true])).integrationApproved,true);assert.equal(compare(make([false]),make([true])).integrationApproved,false);assert.equal(compare(make([true]),make([false])).integrationApproved,false);assert.throws(()=>compare(make([true]),make([true,true])))});
