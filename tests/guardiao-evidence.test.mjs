import test from 'node:test';import assert from 'node:assert/strict';
import {createInvestigation,validateInvestigation} from '../apps/mobile/guardiao/evidence.ts';
test('starts inconclusive and never guesses a commercial origin',()=>{
 const i=createInvestigation('local-1','2026-10-18T17:00:00-03:00');
 assert.equal(i.result,'inconclusive');assert.equal(i.commercialOrigin.status,'unknown');
 assert.equal(i.commercialOrigin.value,null);assert.deepEqual(validateInvestigation(i),[]);
});
test('rejects unsupported confirmed claims and unsafe source URLs',()=>{
 const i=createInvestigation('local-2','2026-10-18T17:00:00-03:00');
 i.issuer={value:'Empresa X',status:'confirmed',evidenceIds:['missing']};
 assert.ok(validateInvestigation(i).length>0);
 i.evidence=[{id:'missing',source:'official-registry',title:'Registro',url:'http://example.test',checkedAt:'2026-10-18',summary:'Exemplo'}];
 assert.ok(validateInvestigation(i).some(x=>x.includes('URL')));
});
test('accepts an evidenced claim without upgrading unknown fields',()=>{
 const i=createInvestigation('local-3','2026-10-18T17:00:00-03:00');
 i.evidence=[{id:'bank-1',source:'bank-authorized',title:'Consulta autorizada',checkedAt:'2026-10-18',summary:'Resultado de teste'}];
 i.beneficiary={value:'Empresa de teste',status:'confirmed',evidenceIds:['bank-1']};
 assert.deepEqual(validateInvestigation(i),[]);
 assert.equal(i.commercialOrigin.status,'unknown');
});
