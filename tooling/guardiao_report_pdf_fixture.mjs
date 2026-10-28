#!/usr/bin/env node
/**
 * LAB ONLY. Generates synthetic HTML with the real Guardiao report generator.
 * Does not contain payable boleto lines, customer data, financial APK, or secrets.
 */
import {writeFileSync, mkdirSync} from 'node:fs';
import {isAbsolute, join} from 'node:path';
import {createLocalReport, renderReportHtml} from '../apps/mobile/guardiao/report.ts';

const destination=process.argv[2];
if(!destination || !isAbsolute(destination))throw new Error('absolute isolated fixture directory required');
mkdirSync(destination,{recursive:true,mode:0o700});

const inspection=valid=>({
  kind:'BOLETO BANCÁRIO',
  digits:47,
  valid,
  explanation:'0'.repeat(47) // deliberately invalid fictitious digits, never printed
});
const time='2026-10-28T12:00:00Z';
const variants=[
  ['invalid',createLocalReport(inspection(false),time)],
  ['consistent',createLocalReport(inspection(true),time)],
  ['registry',createLocalReport(inspection(true),time,{
    status:'found',cnpj:'00000000000000',legalName:'LABORATORIO FICTICIO LTDA',
    registration:'ATIVA',checkedAt:time,source:'https://example.invalid/never-called'
  })],
  ['unavailable',createLocalReport(inspection(false),time,{
    status:'unavailable',cnpj:'00000000000000',
    message:'CONSULTA FICTICIA INDISPONIVEL'
  })]
];
for(const [name,report] of variants){
  const html=renderReportHtml(report);
  if(report.legitimacy!=='unknown' ||
     html.includes('0'.repeat(47)) ||
     html.includes('00000000000000') ||
     /<script\b|<iframe\b|<img\b|<link\b|<form\b|<base\b/i.test(html) ||
     /https?:\/\//i.test(html)){
    throw new Error('synthetic HTML failed privacy boundary');
  }
  writeFileSync(join(destination,'report-'+name+'.html'),html,{encoding:'utf8',mode:0o600,flag:'wx'});
}
// Never print the HTML or synthetic document contents to stdout.
