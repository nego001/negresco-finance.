import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {probeMinimalPrintEngine} from '../apps/mobile/guardiao/pdfPrintProbe.ts';

const SYNTH_URI='file:///data/user/0/com.negresco.finance/cache/Print/12345678-1234-4123-a123-123456789abc.pdf';
const make=(patch={})=>{
  const calls={html:[],inspected:[],discarded:[]};
  const ports={
    print:async html=>{calls.html.push(html);return {uri:SYNTH_URI};},
    inspectOwnedPdf:async uri=>{calls.inspected.push(uri);return true;},
    discardOwnedPdf:async uri=>{calls.discarded.push(uri);return true;},
    ...patch
  };
  return {calls,ports};
};
test('minimal synthetic renderer creates a separate PDF and always discards it',async()=>{
  const {calls,ports}=make();
  assert.equal(await probeMinimalPrintEngine(ports),'minimal-output-created');
  assert.deepEqual(calls.inspected,[SYNTH_URI]);
  assert.deepEqual(calls.discarded,[SYNTH_URI]);
});
test('HTML in probe is fixed, synthetic and never contains original boleto or financial report',async()=>{
  const {calls,ports}=make();
  assert.equal(await probeMinimalPrintEngine(ports),'minimal-output-created');
  assert.equal(calls.html.length,1);
  assert.match(calls.html[0],/TESTE LOCAL SINTETICO DE PDF/);
  assert.doesNotMatch(calls.html[0],/boleto|cnpj|benefici[aá]rio|PIX|CPF|dados privados/i);
});
test('minimal renderer failure does not leak error details, or request a share',async()=>{
  let inspected=0,discarded=0;
  const result=await probeMinimalPrintEngine({
    print:async()=>{throw Error('synthetic private exception content');},
    inspectOwnedPdf:async()=>{inspected++;return true;},
    discardOwnedPdf:async()=>{discarded++;return true;}
  });
  assert.equal(result,'minimal-print-failed');
  assert.equal(inspected,0);assert.equal(discarded,0);
});
test('unexpected remote URI never counts as confirmed PDF',async()=>{
  let discarded=null;
  const result=await probeMinimalPrintEngine({
    print:async()=>({uri:'https://fake.example/private.pdf'}),
    inspectOwnedPdf:async()=>false,
    discardOwnedPdf:async uri=>{discarded=uri;return false;}
  });
  assert.equal(result,'minimal-output-unverified');
  assert.equal(discarded,'https://fake.example/private.pdf');
});
test('missing URI is not reported as successful generation',async()=>{
  const {ports}=make({print:async()=>({uri:null})});
  assert.equal(await probeMinimalPrintEngine(ports),'minimal-output-unverified');
});
test('inspection errors fail closed and still attempt private-cache cleanup',async()=>{
  const {calls,ports}=make({inspectOwnedPdf:async()=>{throw Error('synthetic inspection failure');}});
  assert.equal(await probeMinimalPrintEngine(ports),'minimal-output-unverified');
  assert.deepEqual(calls.discarded,[SYNTH_URI]);
});
test('cleanup errors do not change diagnostic or reveal an exception',async()=>{
  const {ports}=make({discardOwnedPdf:async()=>{throw Error('synthetic filesystem failure');}});
  assert.equal(await probeMinimalPrintEngine(ports),'minimal-output-created');
});
test('App integration never shares probe output or uses original report content for the probe',()=>{
  const app=readFileSync('apps/mobile/App.tsx','utf8');
  const source=readFileSync('apps/mobile/guardiao/pdfPrintProbe.ts','utf8');
  assert.match(app,/LAB ONLY\. Never substitute the synthetic probe for the real report/);
  assert.match(app,/diagnosis\.minimal=await probeMinimalPrintEngine\(\{/);
  assert.match(app,/print:html=>Print\.printToFileAsync\(\{html\}\)/);
  assert.match(app,/isOwnedPrintPdfUri\(uri,FileSystem\.cacheDirectory\)/);
  assert.match(app,/FileSystem\.getInfoAsync\(uri\)/);
  assert.match(app,/discardOwnedPdf:uri=>discardUnsharedPrintPdf\(/);
  assert.match(app,/throw new Error\('LAB_ORIGINAL_PDF_PRINT_FAILED'\)/);
  assert.match(app,/reportRequestId\.current===requestId&&AppState\.currentState==='active'/);
  assert.doesNotMatch(source,/\.shareAsync|sharePdf|reportHtml|boletoLine|cnpjResult/);
  for(const label of ['Teste sintético mínimo criou arquivo local.','Teste sintético mínimo também falhou.'])
    assert.ok(app.includes(label));
});
