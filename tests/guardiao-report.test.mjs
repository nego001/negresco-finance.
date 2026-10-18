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
