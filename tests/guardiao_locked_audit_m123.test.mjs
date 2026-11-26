import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from '../tooling/android/guardiao_locked_audit_m123.mjs';
const lock={packages:{'':{},'node_modules/foo':{version:'1.2.3'}}};
const blank=()=>({auditReportVersion:2,vulnerabilities:{},metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}}});
const high=()=>{const r=blank();r.vulnerabilities.foo={name:'foo',severity:'high',nodes:['node_modules/foo'],isDirect:false};r.metadata.vulnerabilities.high=1;r.metadata.vulnerabilities.total=1;return r};
test('M123 clean evidence never authorizes production',()=>{const r=summarize(blank(),0,lock);assert.equal(r.total,0);assert.equal(r.approvedForProduction,false);assert.equal(r.stableReleaseAllowed,false)});
test('M123 finding is tied to exact locked version and remains blocked',()=>{const r=summarize(high(),1,lock);assert.equal(r.highOrCriticalPresent,true);assert.deepEqual(r.findings,[{name:'foo',severity:'high',versions:['1.2.3'],direct:false}]);assert.equal(r.approvedForProduction,false)});
test('M123 rejects registry errors, mismatched counts and unknown installed paths',()=>{assert.throws(()=>summarize({error:{}},1,lock));assert.throws(()=>summarize(high(),0,lock));assert.throws(()=>summarize(blank(),2,lock));const r=high();r.vulnerabilities.foo.nodes=['node_modules/bar'];assert.throws(()=>summarize(r,1,lock));const s=high();s.metadata.vulnerabilities.high=0;assert.throws(()=>summarize(s,1,lock))});
