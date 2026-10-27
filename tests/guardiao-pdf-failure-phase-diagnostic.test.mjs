import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportPdfWithLifecycleGuard} from '../apps/mobile/guardiao/pdfExport.ts';

const URI='file:///data/user/0/com.negresco.finance/cache/Print/12345678-1234-4123-a123-123456789abc.pdf';
const base=(patch={})=>({
  html:'<h1>SYNTHETIC TEST ONLY</h1>',
  print:async()=>({uri:URI}),
  sharingAvailable:async()=>true,
  share:async()=>{},
  isCurrent:()=>true,
  ...patch
});
const collect=(patch={})=>{
  const phases=[];
  return {phases,ports:base({...patch,onFailurePhase:code=>phases.push(code)})};
};

test('print exception returns failure phase only, never raw exception content',async()=>{
  const {phases,ports}=collect({print:async()=>{throw Error('private synthetic PDF content must not appear');}});
  assert.equal(await exportPdfWithLifecycleGuard(ports),'failed');
  assert.deepEqual(phases,['print']);
});
test('invalid PDF URI is rejected before native availability and classified only as invalid-uri',async()=>{
  let called=0;
  const {phases,ports}=collect({print:async()=>({uri:'https://invalid.example/private.pdf'}),sharingAvailable:async()=>{called++;return true;}});
  assert.equal(await exportPdfWithLifecycleGuard(ports),'failed');
  assert.deepEqual(phases,['invalid-uri']);assert.equal(called,0);
});
test('availability probe exception distinguishes Android module from print renderer',async()=>{
  const {phases,ports}=collect({sharingAvailable:async()=>{throw Error('synthetic availability exception');}});
  assert.equal(await exportPdfWithLifecycleGuard(ports),'failed');
  assert.deepEqual(phases,['availability']);
});
test('native share exception distinguishes Android chooser from successful PDF generation',async()=>{
  const {phases,ports}=collect({share:async()=>{throw Error('synthetic chooser exception');}});
  assert.equal(await exportPdfWithLifecycleGuard(ports),'failed');
  assert.deepEqual(phases,['share']);
});
test('sharing unavailable returns unavailable, never a diagnostic failure phase',async()=>{
  const {phases,ports}=collect({sharingAvailable:async()=>false});
  assert.equal(await exportPdfWithLifecycleGuard(ports),'unavailable');
  assert.deepEqual(phases,[]);
});
test('stale export suppresses failure phase and cannot leak prior sensitive context',async()=>{
  let current=true;
  const {phases,ports}=collect({isCurrent:()=>current,print:async()=>{
    current=false;
    throw Error('synthetic sensitive report leak marker');
  }});
  assert.equal(await exportPdfWithLifecycleGuard(ports),'cancelled');
  assert.deepEqual(phases,[]);
});
test('throwing diagnostic observer cannot convert a safe failure into an exception',async()=>{
  const ports=base({print:async()=>{throw Error('synthetic error');},
    onFailurePhase:()=>{throw Error('synthetic observer error');}});
  assert.equal(await exportPdfWithLifecycleGuard(ports),'failed');
});
test('successful chooser never emits a failure phase',async()=>{
  const {phases,ports}=collect();
  assert.equal(await exportPdfWithLifecycleGuard(ports),'shared');
  assert.deepEqual(phases,[]);
});
test('mobile user-facing diagnostics are fixed phase-only messages with no native error interpolation',()=>{
  const app=readFileSync('apps/mobile/App.tsx','utf8');
  const exportSource=readFileSync('apps/mobile/guardiao/pdfExport.ts','utf8');
  assert.match(app,/onFailurePhase:phase=>\{diagnosis\.phase=phase;\}/);
  for(const literal of ['Falha ao gerar o PDF local.',
     'O arquivo PDF gerado não tem um endereço local válido.',
     'Falha ao verificar o compartilhamento disponível.',
     'Falha ao abrir o compartilhamento nativo do Android.'])
    assert.ok(app.includes(literal),'missing fixed Portuguese UI phase '+literal);
  assert.match(exportSource,/onFailurePhase\?:\(phase:PdfExportFailurePhase\)=>void/);
  assert.doesNotMatch(app,/setReportExportStatus\(.*(?:\.message|\.stack|\.uri|JSON\.stringify\(.*Error)/);
});
