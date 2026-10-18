import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeCnpj,consultCnpj} from '../apps/mobile/guardiao/company.ts';
test('CNPJ validates check digits',()=>{assert.equal(normalizeCnpj('11.222.333/0001-81'),'11222333000181');assert.equal(normalizeCnpj('11.111.111/1111-11'),null);});
test('registry source response is labeled and not a fraud verdict',async()=>{const result=await consultCnpj('11.222.333/0001-81',async()=>({ok:true,status:200,json:async()=>({razao_social:'EMPRESA TESTE',descricao_situacao_cadastral:'ATIVA'})}));assert.equal(result.status,'found');assert.equal(result.legalName,'EMPRESA TESTE');assert.match(result.source,/brasilapi/);});

test('invalid CNPJ never makes an HTTP request',async()=>{
 let requested=false;
 const result=await consultCnpj('00.000.000/0000-00',async()=>{requested=true;throw Error('unexpected fetch');});
 assert.equal(result.status,'unavailable');
 assert.equal(requested,false);
});
test('lookup reports HTTP 404 without inventing company registration',async()=>{
 const result=await consultCnpj('11.222.333/0001-81',async()=>({ok:false,status:404}));
 assert.equal(result.status,'not-found');
 assert.equal(result.legalName,undefined);
});
test('lookup stops waiting on an unresponsive provider and aborts request',async()=>{
 let aborted=false;
 const fetcher=async(_url,{signal})=>{
  signal.addEventListener('abort',()=>{aborted=true;},{once:true});
  return new Promise(()=>{});
 };
 const result=await consultCnpj('11.222.333/0001-81',fetcher,15);
 assert.equal(result.status,'unavailable');
 assert.match(result.message,/tempo limite/i);
 assert.equal(aborted,true);
});
test('lookup deadline also applies to stalled JSON response',async()=>{
 const result=await consultCnpj('11.222.333/0001-81',async()=>({ok:true,status:200,json:async()=>new Promise(()=>{})}),15);
 assert.equal(result.status,'unavailable');
 assert.match(result.message,/tempo limite/i);
});
