import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportPdfWithLifecycleGuard} from '../apps/mobile/guardiao/pdfExport.ts';
import {createPdfNativeExportGate} from '../apps/mobile/guardiao/pdfSingleFlight.ts';

// Deterministic native-port simulation. No Android, real PDF, financial input,
// process timers, network, or file I/O beyond the static source contract below.
const HTML='<!doctype html><p>ONLY SYNTHETIC FIXTURE</p>';
const URI='file:///data/user/0/com.negresco.finance/cache/lab-only.pdf';
function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
async function flush(){
 for(let i=0;i<8;i++)await Promise.resolve();
}

for(const suspended of ['print','availability','share']){
 test('unresolved native '+suspended+' holds the gate, rejects a second export, and never fabricates success',async()=>{
  const pending=deferred(), gate=createPdfNativeExportGate();
  let authorized=true;
  const phases=[], failures=[],events=[];
  let prints=0, availabilityChecks=0, shares=0, discarded=0, released=0;
  const start=async()=>{
   if(!authorized)return 'not-authorized';
   const release=gate.acquire();
   if(!release)return 'already-running';
   try{
    return await exportPdfWithLifecycleGuard({
     html:HTML,
     isCurrent:()=>authorized,
     onPendingPhase:phase=>phases.push(phase),
     onFailurePhase:phase=>failures.push(phase),
     print:html=>{
      assert.equal(html,HTML);
      prints++;
      events.push('print');
      return suspended==='print'?pending.promise:Promise.resolve({uri:URI});
     },
     sharingAvailable:()=>{
      availabilityChecks++;
      events.push('availability');
      return suspended==='availability'?pending.promise:Promise.resolve(true);
     },
     share:uri=>{
      assert.equal(uri,URI);
      shares++;
      events.push('share');
      return suspended==='share'?pending.promise:Promise.resolve();
     },
     discardUnsharedFile:async uri=>{
      assert.equal(uri,URI);
      discarded++;
      events.push('discard');
      return true;
     }
    });
   }finally{
    released++;
    events.push('release');
    release();
   }
  };
  const original=start();
  await flush();
  const expectedPhases={
   print:['print'],
   availability:['print','availability'],
   share:['print','availability','share']
  }[suspended];
  assert.deepEqual(phases,expectedPhases);
  assert.equal(prints,1);
  assert.equal(availabilityChecks,suspended==='print'?0:1);
  assert.equal(shares,suspended==='share'?1:0);
  assert.deepEqual(failures,[]);
  assert.equal(discarded,0);
  assert.equal(released,0);
  assert.equal(gate.busy(),true,'the native promise is still outstanding');
  assert.equal(await start(),'already-running');
  assert.equal(prints,1,'second attempt must never invoke native printing');
  assert.equal(shares,suspended==='share'?1:0);
  authorized=false;
  assert.equal(await start(),'not-authorized');
  assert.equal(gate.busy(),true,'navigation or lock cannot release an unsettled native promise');
  assert.equal(released,0);
  pending.resolve(suspended==='print'?{uri:URI}:suspended==='availability'?true:undefined);
  assert.equal(await original,'cancelled','late completion after foreground revocation cannot report shared');
  assert.equal(gate.busy(),false,'release happens only after native settles');
  assert.equal(released,1);
  assert.equal(discarded,suspended==='share'?0:1,
    'files must not be removed after the native chooser was started');
  assert.deepEqual(failures,[]);
  assert.deepEqual(phases,expectedPhases);
  assert.equal(events.at(-1),'release');
 });
}

for(const failedAt of ['print','availability','share']){
 test('rejected native '+failedAt+' stays failed, reports a fixed phase and enforces cleanup',async()=>{
  const gate=createPdfNativeExportGate(),phases=[],failures=[],events=[];
  let discarded=0,shares=0;
  const release=gate.acquire();
  assert.equal(typeof release,'function');
  let verdict;
  try{
   verdict=await exportPdfWithLifecycleGuard({
    html:HTML,
    isCurrent:()=>true,
    onPendingPhase:stage=>phases.push(stage),
    onFailurePhase:stage=>failures.push(stage),
    print:async()=>{events.push('print');if(failedAt==='print')throw Error('PRIVATE SYNTHETIC FAILURE');return {uri:URI};},
    sharingAvailable:async()=>{events.push('availability');if(failedAt==='availability')throw Error('PRIVATE SYNTHETIC FAILURE');return true;},
    share:async uri=>{assert.equal(uri,URI);shares++;events.push('share');if(failedAt==='share')throw Error('PRIVATE SYNTHETIC FAILURE');},
    discardUnsharedFile:async uri=>{assert.equal(uri,URI);discarded++;events.push('discard');return true;}
   });
  }finally{release();}
  assert.equal(verdict,'failed');
  assert.deepEqual(failures,[failedAt],'diagnosis reports only a fixed boundary label');
  assert.deepEqual(phases,{print:['print'],availability:['print','availability'],share:['print','availability','share']}[failedAt]);
  assert.equal(discarded,failedAt==='availability'?1:0);
  assert.equal(shares,failedAt==='share'?1:0);
  assert.equal(gate.busy(),false);
  assert.doesNotMatch(phases.join('|')+failures.join('|'),/PRIVATE|SYNTHETIC FAILURE|file:\/\/|cache\//);
 });
}

test('strict lifecycle denies print after observer revokes authorization at any native boundary',async()=>{
 for(const revokeAt of ['print','availability','share']){
  let authorized=true,print=0,availability=0,share=0,discard=0;
  const stages=[];
  const result=await exportPdfWithLifecycleGuard({
   html:HTML,isCurrent:()=>authorized,
   onPendingPhase:stage=>{stages.push(stage);if(stage===revokeAt)authorized=false;},
   print:async()=>{print++;return {uri:URI};},
   sharingAvailable:async()=>{availability++;return true;},
   share:async()=>{share++;},
   discardUnsharedFile:async()=>{discard++;return true;}
  });
  assert.equal(result,'cancelled');
  assert.deepEqual(stages,{print:['print'],availability:['print','availability'],share:['print','availability','share']}[revokeAt]);
  assert.deepEqual({print,availability,share,discard},{
   print:{print:0,availability:0,share:0,discard:0},
   availability:{print:1,availability:0,share:0,discard:1},
   share:{print:1,availability:1,share:0,discard:1}
  }[revokeAt]);
 }
});

test('one-test-only matrix cannot act as an Android fix, timeout bypass, or Release approval',()=>{
 const flow=readFileSync('apps/mobile/guardiao/pdfExport.ts','utf8');
 const gate=readFileSync('apps/mobile/guardiao/pdfSingleFlight.ts','utf8');
 const app=readFileSync('apps/mobile/App.tsx','utf8');
 const doc=readFileSync('docs/security/P0_GUARDIAO_NATIVE_PDF_THREE_BOUNDARY_DEFERRED_MATRIX.md','utf8');
 assert.match(flow,/const pdf=await ports\.print\(ports\.html\)/);
 assert.match(flow,/const available=await ports\.sharingAvailable\(\)/);
 assert.match(flow,/await ports\.share\(createdUri\)/);
 assert.match(flow,/if\(!nativeShareStarted&&createdUri&&ports\.discardUnsharedFile\)/);
 assert.match(app,/const releasePdfGate=pdfNativeGate\.current\.acquire\(\)/);
 assert.match(app,/releasePdfGate\(\);\s*setReportPdfBusy\(false\)/);
 assert.match(app,/pdfNativeGate\.current\.busy\(\)\)setReportPdfLongPending\(true\)/);
 assert.doesNotMatch(flow+gate,/Promise\.race|AbortController|setTimeout|setInterval/);
 assert.match(doc,/approvedForProduction=false/);
 assert.match(doc,/stableReleaseAllowed=false/);
 assert.match(doc,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
});
