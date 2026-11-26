import test from 'node:test';
import assert from 'node:assert/strict';
import {plan} from '../tooling/android/guardiao_moderate_compat_plan_m132.mjs';
const root=(name,version,range)=>({name,nodes:[{version}],advisories:[{range:'affected'}],parents:[{range}]});
const graph={counts:{high:0,critical:0},rootFindings:[root('glob','13.0.7','^13'),root('minimatch','10.2.6','^10')]};
const versions={glob:['13.0.8','14.0.2'],minimatch:['10.2.7','11.0.1']};
const semver={valid:v=>/^\d+\.\d+\.\d+$/.test(v),validRange:r=>['affected','^13','^10'].includes(r),prerelease:()=>null,gt:(a,b)=>a.localeCompare(b,undefined,{numeric:true})>0,compare:(a,b)=>a.localeCompare(b,undefined,{numeric:true}),satisfies:(v,r)=>r==='affected'?v.startsWith('13.')||v.startsWith('10.'):v.startsWith(r.slice(1)+'.')};
test('M132 reports outside-range versions without automatically overriding parents',()=>{const result=plan(graph,versions,semver);assert.deepEqual(result.map(x=>x.firstNonaffected),['14.0.2','11.0.1']);assert.ok(result.every(x=>x.commonInRange===null&&x.requiresCompatibilityReview&&!x.approvedForProduction))});
test('M132 rejects unexpected high severity or missing root evidence',()=>{assert.throws(()=>plan({...graph,counts:{high:1,critical:0}},versions,semver));assert.throws(()=>plan({...graph,rootFindings:[graph.rootFindings[0]]},versions,semver));assert.throws(()=>plan(graph,{glob:[],minimatch:['invalid']},semver))});
