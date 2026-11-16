import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportPdfWithLifecycleGuard} from '../apps/mobile/guardiao/pdfExport.ts';
import {isOwnedPrintPdfUri,discardUnsharedPrintPdf} from '../apps/mobile/guardiao/pdfCache.ts';

// Only synthetic addresses. The integration uses the real runtime cacheDirectory,
// not this fixture path; no real device or filesystem is accessed.
const CACHE='file:///data/user/0/com.negresco.finance/cache/';
const UUID='12345678-1234-4123-a123-123456789abc';
const OWNED=CACHE+'Print/'+UUID+'.pdf';
const make=({uri=OWNED,validate,discard}={})=>{
 const events=[],diagnostics=[],stages=[];
 const ports={
  html:'<!doctype html><p>UNRELATED SYNTHETIC DATA</p>',
  isCurrent:()=>true,
  isOwnedPdfUri:validate||((v)=>isOwnedPrintPdfUri(v,CACHE)),
  print:async()=>{events.push('print');return {uri};},
  sharingAvailable:async()=>{events.push('available');return true;},
  share:async(v)=>{assert.equal(v,uri);events.push('share');},
  onFailurePhase:v=>diagnostics.push(v),
  onPendingPhase:v=>stages.push(v),
  discardUnsharedFile:discard||((v)=>discardUnsharedPrintPdf(v,CACHE,async()=>{events.push('deleted');}))
 };
 return {ports,events,diagnostics,stages};
};

test('Expo Print UUID in private cache reaches native share once',async()=>{
 const t=make();
 assert.equal(await exportPdfWithLifecycleGuard(t.ports),'shared');
 assert.deepEqual(t.events,['print','available','share']);
 assert.deepEqual(t.diagnostics,[]);
 assert.deepEqual(t.stages,['print','availability','share']);
 assert.equal(isOwnedPrintPdfUri(OWNED,CACHE),true);
});

test('unowned file:// PDF is rejected before native availability or sharing',async()=>{
 const invalid=[
  'file:///data/user/0/com.negresco.finance/files/secret.pdf',
  'file:///sdcard/Download/report.pdf',
  'file:///data/user/0/another.package/cache/Print/'+UUID+'.pdf',
  CACHE+'Print/not-a-uuid.pdf',
  CACHE+'Print/'+UUID+'.pdf?download=1',
  CACHE+'Print/'+UUID+'.pdf#fragment',
  CACHE+'Print/../../secret.pdf',
  CACHE+'Print/%2e%2e/secret.pdf',
  CACHE+'Print/'+UUID+'.pdf/../../secret.pdf',
  'file:///data/user/0/com.negresco.finance/cache2/Print/'+UUID+'.pdf',
  'file:///private/lab/example.pdf'
 ];
 for(const uri of invalid){
  const t=make({uri});
  assert.equal(await exportPdfWithLifecycleGuard(t.ports),'failed',uri);
  assert.deepEqual(t.events,['print'],uri);
  assert.deepEqual(t.diagnostics,['invalid-uri'],uri);
  assert.deepEqual(t.stages,['print'],uri);
 }
});

test('invalid ownership fails closed when cache root is absent, falsey or malformed',async()=>{
 for(const root of [undefined,null,'',CACHE.slice(0,-1),'file://wrong/cache/']){
  const t=make({validate:uri=>isOwnedPrintPdfUri(uri,root)});
  assert.equal(await exportPdfWithLifecycleGuard(t.ports),'failed');
  assert.deepEqual(t.events,['print']);
  assert.deepEqual(t.diagnostics,['invalid-uri']);
 }
});

test('false truthy and throwing custom ownership validators cannot pass',async()=>{
 for(const value of [false,undefined,null,0,1,'yes',{}]){
  const t=make({validate:()=>value});
  assert.equal(await exportPdfWithLifecycleGuard(t.ports),'failed');
  assert.deepEqual(t.events,['print']);
  assert.deepEqual(t.diagnostics,['invalid-uri']);
 }
 const t=make({validate:()=>{throw Error('PRIVATE FAKE FILE PATH');}});
 assert.equal(await exportPdfWithLifecycleGuard(t.ports),'failed');
 assert.deepEqual(t.events,['print']);
 assert.deepEqual(t.diagnostics,['invalid-uri']);
 assert.doesNotMatch(t.diagnostics.join(''),/PRIVATE|PATH|file:\/\//);
});

test('unowned URI is never deleted even after invalid ownership error',async()=>{
 let calls=0;
 const path='file:///private/another-sandbox/document.pdf';
 const t=make({uri:path,discard:uri=>discardUnsharedPrintPdf(uri,CACHE,async()=>{calls++;})});
 assert.equal(await exportPdfWithLifecycleGuard(t.ports),'failed');
 assert.equal(calls,0);
 assert.deepEqual(t.events,['print']);
});

test('stale foreground token after print prohibits ownership check and sharing',async()=>{
 let token=true, validateCount=0, shareCount=0;
 const t=make({validate:()=>{validateCount++;return true;}});
 t.ports.print=async()=>{token=false;return {uri:OWNED};};
 t.ports.isCurrent=()=>token;
 t.ports.share=async()=>{shareCount++;};
 assert.equal(await exportPdfWithLifecycleGuard(t.ports),'cancelled');
 assert.equal(validateCount,0);
 assert.equal(shareCount,0);
 assert.deepEqual(t.diagnostics,[]);
});

test('mobile call site enforces real Expo Print ownership before availability and native share',()=>{
 const app=readFileSync('apps/mobile/App.tsx','utf8');
 const pdf=readFileSync('apps/mobile/guardiao/pdfExport.ts','utf8');
 const cache=readFileSync('apps/mobile/guardiao/pdfCache.ts','utf8');
 const from=app.indexOf('  const exportLocalPdf=async()=>{'),to=app.indexOf('  const [guardiaoHistory',from);
 const flow=app.slice(from,to);
 assert.match(flow,/isOwnedPdfUri:uri=>isOwnedPrintPdfUri\(uri,FileSystem\.cacheDirectory\),\s*sharingAvailable:\(\)=>Sharing\.isAvailableAsync\(\)/);
 assert.match(pdf,/isOwnedPdfUri\?:\(uri:string\)=>boolean/);
 assert.match(pdf,/ports\.isOwnedPdfUri&&ports\.isOwnedPdfUri\(createdUri\)!==true/);
 assert.match(cache,/const UUID_PDF=/);
 assert.match(flow,/discardUnsharedFile:uri=>discardUnsharedPrintPdf\(uri,FileSystem\.cacheDirectory/);
 assert.doesNotMatch(flow,/Promise\.race|setTimeout\(|console\.log\(/);
});
