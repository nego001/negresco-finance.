import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalReport, renderReportHtml} from '../apps/mobile/guardiao/report.ts';

// P0 synthetic-only: validate the exact source used to produce print HTML.
// These assertions do NOT inspect a rendered PDF or establish authenticity.
const date='2026-10-28T12:00:00Z';
const input=(valid=false, kind='BOLETO BANCÁRIO')=>({
  kind, digits:kind==='ARRECADAÇÃO'?48:47, valid, explanation:'0'.repeat(47)
});
const make=(valid=false,company=null)=>createLocalReport(input(valid),date,company);

test('invalid synthetic boleto never leaks its 47-digit line into HTML',()=>{
  const rawLine='0'.repeat(47); // deliberately invalid and not a payable boleto
  const report=make();
  const html=renderReportHtml(report);
  assert.equal(html.includes(rawLine),false);
  assert.equal(report.legitimacy,'unknown');
  assert.equal(report.issuer,null);
  assert.equal(report.beneficiary,null);
  assert.equal(report.commercialOrigin,null);
  assert.equal(report.sourcesConsulted,0);
  assert.match(html,/Dígitos inconsistentes ou formato inválido/);
  assert.match(html,/Fontes externas consultadas: 0/);
  assert.match(html,/Legitimidade da cobrança: inconclusiva/);
});

test('even a consistent checksum cannot become a false legitimacy verdict',()=>{
  const report=make(true);
  const html=renderReportHtml(report);
  assert.equal(report.checksum,'consistent');
  assert.equal(report.legitimacy,'unknown');
  assert.match(html,/Dígitos consistentes/);
  assert.match(html,/Beneficiário: não identificado no banco/);
  assert.match(html,/Emissor: não identificado no banco/);
  assert.match(html,/Registro bancário: não consultado/);
  assert.match(html,/Origem comercial e dívida: não comprovadas/);
  assert.match(html,/Confira os dados no aplicativo oficial do banco antes de pagar/);
  assert.match(html,/Legitimidade da cobrança: inconclusiva/);
  assert.doesNotMatch(html,/autenticidade confirmada|pagamento autorizado|boleto legítimo/iu);
});

test('registry found stays third-party-only and never discloses raw CNPJ or source URL',()=>{
  const fakeCnpj='00000000000000';
  const report=make(true,{
    status:'found',cnpj:fakeCnpj,source:'https://example.invalid/api/cnpj/'+fakeCnpj,
    legalName:'EMPRESA FICTÍCIA LAB',registration:'ATIVA',
    checkedAt:date
  });
  const html=renderReportHtml(report);
  assert.equal(report.sourcesConsulted,1);
  assert.match(html,/Fontes externas consultadas: 1/);
  assert.match(html,/BrasilAPI \(terceiros\):/);
  assert.match(html,/Cadastro encontrado/);
  assert.match(html,/Consulta independente/);
  assert.match(html,/Legitimidade da cobrança: inconclusiva/);
  assert.ok(!html.includes(fakeCnpj));
  assert.ok(!html.includes('example.invalid'));
  assert.ok(!('cnpj' in report));
});

test('not-found registry response is not elevated into fraud proof',()=>{
  const report=make(false,{status:'not-found',cnpj:'00000000000000',message:'SEM RESULTADO'});
  const html=renderReportHtml(report);
  assert.equal(report.sourcesConsulted,1);
  assert.match(html,/Cadastro não encontrado nesta fonte/);
  assert.match(html,/Legitimidade da cobrança: inconclusiva/);
  assert.equal(report.legitimacy,'unknown');
});

test('unavailable registry never masquerades as a completed external lookup',()=>{
  const report=make(false,{status:'unavailable',message:'CONSULTA FICTÍCIA INDISPONÍVEL'});
  const html=renderReportHtml(report);
  assert.equal(report.sourcesConsulted,0);
  assert.match(html,/Fontes externas consultadas: 0/);
  assert.match(html,/Consulta não concluída/);
  assert.match(html,/Legitimidade da cobrança: inconclusiva/);
});

test('all interpolated untrusted labels are escaped before entering print HTML',()=>{
  const kind='<svg onload=alert(1)>';
  const injectedDate='"><img src=x onerror=alert(2)>';
  const report=createLocalReport({
    kind,digits:48,valid:false,explanation:'DADO FICTÍCIO'
  },injectedDate,{
    status:'found',cnpj:'00000000000000',
    legalName:'<script>alert(3)</script>',
    registration:'ATIVA & "TESTE"',
    checkedAt:'<i>2026</i>',
    message:"<a href='file:///tmp/demo'>malicioso</a>"
  });
  const html=renderReportHtml(report);
  for(const forbidden of ['<script>','<svg onload=','<img src=','<i>2026</i>','<a href=','file:///tmp/demo']) {
    // The file:/// string occurs only as escaped text in a disclaimer-free fixture:
    if(forbidden==='file:///tmp/demo')continue;
    assert.ok(!html.includes(forbidden),'raw HTML leaked: '+forbidden);
  }
  for(const safe of ['&lt;svg','&lt;img','&lt;script&gt;','ATIVA &amp; &quot;TESTE&quot;','&lt;i&gt;2026&lt;/i&gt;','&lt;a href=']) {
    assert.ok(html.includes(safe),'expected escaped field: '+safe);
  }
  assert.doesNotMatch(html,/<script|onerror=alert|onload=alert/iu);
});

test('long registry details are bounded before rendering',()=>{
  const report=make(false,{
    status:'found',legalName:'L'.repeat(600),registration:'R'.repeat(500),message:'M'.repeat(500)
  });
  assert.equal(report.registry.legalName.length,160);
  assert.equal(report.registry.registration.length,80);
  assert.equal(report.registry.message.length,160);
  const html=renderReportHtml(report);
  assert.equal(html.includes('L'.repeat(161)),false);
  assert.equal(html.includes('R'.repeat(81)),false);
  assert.equal(html.includes('M'.repeat(161)),false);
});

test('HTML labels remain honest for 48-digit synthetic collection records',()=>{
  const report=createLocalReport(input(false,'ARRECADAÇÃO'),date);
  const html=renderReportHtml(report);
  assert.equal(report.kind,'ARRECADAÇÃO');
  assert.equal(report.digits,48);
  assert.match(html,/Quantidade de dígitos:<\/strong> 48/);
  assert.match(html,/Legitimidade da cobrança: inconclusiva/);
  assert.match(html,/Nenhuma consulta externa de CNPJ incluída/);
});

test('generated HTML has no active scripts or direct external network requests',()=>{
  const html=renderReportHtml(make());
  assert.match(html,/<!DOCTYPE html>/i);
  assert.match(html,/<html lang="pt-BR">/);
  assert.doesNotMatch(html,/<script|<iframe|<form|<link\b|<img\b|<base\b/iu);
  assert.doesNotMatch(html,/https?:\/\/|XMLHttpRequest|fetch\(|navigator\.|window\.location/iu);
  assert.match(html,/Nenhuma operação de pagamento foi realizada/);
});
