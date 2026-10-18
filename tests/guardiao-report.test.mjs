import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalReport,renderReportHtml} from '../apps/mobile/guardiao/report.ts';
test('PDF source report never contains a boleto or claims external research',()=>{
 const line='23790000000000000000000000000000000000000000000';
 const report=createLocalReport({kind:'BOLETO BANCÁRIO',digits:47,valid:false,explanation:line},'2026-10-18');
 const html=renderReportHtml(report);
 assert.equal(html.includes(line),false);assert.match(html,/Fontes externas consultadas: 0/);assert.match(html,/inconclusiva/);
});
test('HTML escapes untrusted labels',()=>{
 const report=createLocalReport({kind:'<script>alert(1)</script>',digits:47,valid:false,explanation:''},'2026-10-18');
 const html=renderReportHtml(report);
 assert.equal(html.includes('<script>'),false);assert.match(html,/&lt;script&gt;/);
});

test('PDF labels the optional registry response without confirming a boleto beneficiary',()=>{
 const cnpj='11222333000181';
 const report=createLocalReport({kind:'BOLETO BANCÁRIO',digits:47,valid:true,explanation:''},'2026-10-18',{
  status:'found',cnpj,legalName:'EMPRESA DE TESTE',registration:'ATIVA',checkedAt:'2026-10-18T23:00:00Z',
  source:'https://brasilapi.com.br/api/cnpj/v1/'+cnpj
 });
 const html=renderReportHtml(report);
 assert.match(html,/Fontes externas consultadas: 1/);
 assert.match(html,/EMPRESA DE TESTE/);
 assert.match(html,/Consulta independente/);
 assert.match(html,/Legitimidade da cobrança: inconclusiva/);
 assert.equal(html.includes(cnpj),false);
 assert.equal(html.includes('/api/cnpj/v1/'),false);
});
test('PDF escapes third-party company details',()=>{
 const report=createLocalReport({kind:'ARRECADAÇÃO',digits:48,valid:false,explanation:''},'2026-10-18',{
  status:'found',cnpj:'11222333000181',legalName:'<img src=x onerror=alert(1)>',
  registration:'ATIVA & REVISADA'
 });
 const html=renderReportHtml(report);
 assert.doesNotMatch(html,/<img src=x/);
 assert.match(html,/&lt;img/);
 assert.match(html,/ATIVA &amp; REVISADA/);
});
test('unavailable external search stays unverified and does not pretend a response',()=>{
 const report=createLocalReport({kind:'FORMATO DESCONHECIDO',digits:2,valid:false,explanation:''},'2026-10-18',{
  status:'unavailable',cnpj:'',message:'Tempo limite excedido'
 });
 const html=renderReportHtml(report);
 assert.match(html,/Fontes externas consultadas: 0/);
 assert.match(html,/Consulta não concluída/);
 assert.match(html,/Tempo limite excedido/);
});
