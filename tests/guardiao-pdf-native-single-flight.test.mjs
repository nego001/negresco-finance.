import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPdfNativeExportGate} from '../apps/mobile/guardiao/pdfSingleFlight.ts';

const deferred=()=>{
  let resolve=()=>{},reject=()=>{};
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
};

test('a rapid second PDF tap is rejected synchronously before another native print',()=>{
  const gate=createPdfNativeExportGate();
  assert.equal(gate.busy(),false);
  const release=gate.acquire();
  assert.equal(typeof release,'function');
  assert.equal(gate.busy(),true);
  assert.equal(gate.acquire(),null,'a second press must not start print');
  release();
  assert.equal(gate.busy(),false);
  release();
  assert.equal(gate.busy(),false,'releasing the same token twice is harmless');
  const after=gate.acquire();
  assert.equal(typeof after,'function');
  after();
});

test('revoking screen authorization does not unlock an unresolved Android native operation',async()=>{
  const gate=createPdfNativeExportGate(),job=deferred();
  let authorized=true,printed=0;
  const guarded=async()=>{
    if(!authorized)return 'denied';
    const release=gate.acquire();
    if(!release)return 'already-running';
    try{
      printed++;
      await job.promise;
      return 'settled';
    }finally{release();}
  };
  const first=guarded();
  assert.equal(await guarded(),'already-running');
  authorized=false;
  assert.equal(await guarded(),'denied');
  assert.equal(gate.busy(),true,'token revocation does not cancel native print');
  authorized=true;
  assert.equal(await guarded(),'already-running','cannot overlap a previously revoked print');
  assert.equal(printed,1);
  job.resolve();
  assert.equal(await first,'settled');
  assert.equal(gate.busy(),false);
});

test('a rejection releases the gate only when the native promise settles',async()=>{
  const gate=createPdfNativeExportGate(),job=deferred();
  const active=(async()=>{
    const release=gate.acquire();
    assert.equal(typeof release,'function');
    try{await job.promise;}finally{release();}
  })();
  assert.equal(gate.acquire(),null);
  job.reject(Error('synthetic-only native failure'));
  await assert.rejects(active,/synthetic-only native failure/);
  assert.equal(gate.busy(),false);
  const after=gate.acquire();
  assert.equal(typeof after,'function');
  after();
});

test('App uses synchronous gate plus disabled button and finally, never releases on timeout',()=>{
  const app=readFileSync('apps/mobile/App.tsx','utf8');
  const gate=readFileSync('apps/mobile/guardiao/pdfSingleFlight.ts','utf8');
  const flow=app.slice(app.indexOf('  const exportLocalPdf=async()=>{'),app.indexOf('  const [guardiaoHistory'));
  assert.ok(flow.length>2000,'export function not found');
  assert.match(app,/const pdfNativeGate=useRef\(createPdfNativeExportGate\(\)\)/);
  assert.match(app,/const \[reportPdfBusy,setReportPdfBusy\]=useState\(false\)/);
  assert.match(flow,/const releasePdfGate=pdfNativeGate\.current\.acquire\(\);\s*if\(!releasePdfGate\)return;\s*setReportPdfBusy\(true\);\s*try\{/);
  assert.match(flow,/finally\{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*releasePdfGate\(\);\s*setReportPdfBusy\(false\);/);
  assert.match(app,/disabled=\{reportPdfBusy\} onPress=\{exportLocalPdf\}/);
  assert.match(flow,/exportPdfWithLifecycleGuard\(\{/);
  assert.match(flow,/reportRequestId\.current!==requestId/);
  assert.doesNotMatch(flow,/Promise\.race|setTimeout|clearTimeout/);
  assert.doesNotMatch(gate,/setTimeout|Promise\.race|clearInterval|AbortController/);
});
