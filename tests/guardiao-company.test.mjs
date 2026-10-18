import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeCnpj,consultCnpj} from '../apps/mobile/guardiao/company.ts';
test('CNPJ validates check digits',()=>{assert.equal(normalizeCnpj('11.222.333/0001-81'),'11222333000181');assert.equal(normalizeCnpj('11.111.111/1111-11'),null);});
test('registry source response is labeled and not a fraud verdict',async()=>{const result=await consultCnpj('11.222.333/0001-81',async()=>({ok:true,status:200,json:async()=>({razao_social:'EMPRESA TESTE',descricao_situacao_cadastral:'ATIVA'})}));assert.equal(result.status,'found');assert.equal(result.legalName,'EMPRESA TESTE');assert.match(result.source,/brasilapi/);});
