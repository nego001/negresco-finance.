import test from 'node:test';import assert from 'node:assert/strict';
import {createInvestigation,validateInvestigation,buildEvidenceReview} from '../apps/mobile/guardiao/evidence.ts';
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

test('evidence review never treats mathematical validation as proof of legitimacy',()=>{
 const review=buildEvidenceReview({valid:true,kind:'BOLETO BANCÁRIO',digits:47,explanation:'checksums pass'},null);
 assert.equal(review.legitimacy,'unknown');
 assert.equal(review.externalResponses,0);
 assert.equal(review.rows.find(x=>x.id==='checksum').status,'local-checked');
 assert.equal(review.rows.find(x=>x.id==='beneficiary').status,'not-checked');
 assert.match(review.rows.find(x=>x.id==='checksum').detail,/não confirma/i);
});
test('a registry response is independent evidence, not beneficiary verification',()=>{
 const review=buildEvidenceReview(null,{status:'found',cnpj:'11222333000181',legalName:'EMPRESA TESTE',registration:'ATIVA',source:'https://brasilapi.com.br/api/cnpj/v1/11222333000181'});
 assert.equal(review.externalResponses,1);
 assert.equal(review.legitimacy,'unknown');
 assert.equal(review.rows.find(x=>x.id==='company').status,'external-response');
 assert.match(review.rows.find(x=>x.id==='company').detail,/Não foi comprovado vínculo/);
 assert.equal(review.rows.find(x=>x.id==='bank').status,'not-checked');
});
test('failed external lookup does not count as researched company',()=>{
 const review=buildEvidenceReview(null,{status:'unavailable',cnpj:'',message:'Tempo limite da consulta excedido.'});
 assert.equal(review.externalResponses,0);
 assert.equal(review.rows.find(x=>x.id==='company').status,'external-unavailable');
 assert.match(review.rows.find(x=>x.id==='company').detail,/Tempo limite/);
});
test('not found in third party registry does not mean fraud',()=>{
 const review=buildEvidenceReview(null,{status:'not-found',cnpj:'11222333000181',source:'https://brasilapi.com.br/api/cnpj/v1/11222333000181'});
 assert.equal(review.externalResponses,1);
 assert.equal(review.legitimacy,'unknown');
 assert.match(review.rows.find(x=>x.id==='company').detail,/não prova fraude/);
});
