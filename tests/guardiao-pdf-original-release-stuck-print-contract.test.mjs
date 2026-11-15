import test from 'node:test';
import assert from 'node:assert/strict';
import {exportPdfWithLifecycleGuard} from '../apps/mobile/guardiao/pdfExport.ts';
import {createPdfNativeExportGate} from '../apps/mobile/guardiao/pdfSingleFlight.ts';
import {readFileSync} from 'node:fs';

function deferred(){
 let resolve;
 const promise=new Promise(yes=>{resolve=yes;});
 return {promise,resolve};
}

test('unresolved native print stays pending, forbids second print and never reports shared',async()=>{
 const gate=createPdfNativeExportGate();
 const job=deferred();
 let authorized=true,printCount=0,shareCount=0,availableCount=0,settled=false;
 const phases=[];
 const validUri='file:///data/user/0/com.negresco.finance/cache/synthetic.pdf';
 async function start(){
  if(!authorized)return 'cancelled';
  const release=gate.acquire();
  if(!release)return 'already-running';
  try{
   return await exportPdfWithLifecycleGuard({
    html:'<html><body>Somente teste sintético</body></html>',
    print:()=>{printCount++;return job.promise;},
    sharingAvailable:async()=>{availableCount++;return true;},
    share:async()=>{shareCount++;},
    isCurrent:()=>authorized,
    onPendingPhase:phase=>phases.push(phase)
   });
  }finally{settled=true;release();}
 }
 const first=start();
 assert.deepEqual(phases,['print'],'last native boundary was print');
 assert.equal(printCount,1);
 assert.equal(gate.busy(),true);
 assert.equal(await start(),'already-running');
 await Promise.resolve();
 await Promise.resolve();
 assert.equal(settled,false,'native promise never completed');
 assert.equal(gate.busy(),true,'the app cannot release a live native operation');
 assert.equal(availableCount,0);
 assert.equal(shareCount,0);
 authorized=false;
 assert.equal(await start(),'cancelled','background/lock does not trigger another print');
 assert.equal(gate.busy(),true,'revocation cannot cancel the native renderer');
 // The old native call completes after the app lost foreground authorization.
 job.resolve({uri:validUri});
 assert.equal(await first,'cancelled');
 assert.equal(settled,true);
 assert.equal(gate.busy(),false);
 assert.deepEqual(phases,['print']);
 assert.equal(availableCount,0,'late native result must not query sharing');
 assert.equal(shareCount,0,'late native result must never launch a chooser');
});

test('historical Release timeout must remain a blocker despite successful Debug runs',()=>{
 const note=readFileSync('docs/security/P0_GUARDIAO_RELEASE_INTERMITTENT_PRINT_BOUNDARY.md','utf8');
 assert.match(note,/127690550373/);
 assert.match(note,/127690550134/);
 assert.match(note,/127690550231/);
 assert.match(note,/ui-loading-app-foreground/);
 assert.match(note,/approvedForProduction=false/);
 assert.match(note,/stableReleaseAllowed=false/);
 assert.match(note,/não atesta correção do Release/);
});
