import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportPdfWithLifecycleGuard} from '../apps/mobile/guardiao/pdfExport.ts';

const deferred=()=>{
  let resolve=()=>{},reject=()=>{};
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
};
const validUri='file:///data/user/0/com.negresco.finance/cache/guardiao-test.pdf';
function setup(extra={}){
  let active=true;
  const called={print:0,available:0,share:0,uri:null};
  const ports={
    html:'<h1>Dados sintéticos, sem boleto</h1>',
    print:async()=>{called.print++;return {uri:validUri};},
    sharingAvailable:async()=>{called.available++;return true;},
    share:async uri=>{called.share++;called.uri=uri;},
    isCurrent:()=>active,
    ...extra
  };
  return {called,ports,cancel:()=>{active=false;}};
}

test('valid foreground export shares only a local PDF once',async()=>{
  const t=setup();
  assert.equal(await exportPdfWithLifecycleGuard(t.ports),'shared');
  assert.deepEqual(t.called,{print:1,available:1,share:1,uri:validUri});
});
test('stale export before generating never calls native modules',async()=>{
  const t=setup();t.cancel();
  assert.equal(await exportPdfWithLifecycleGuard(t.ports),'cancelled');
  assert.equal(t.called.print,0);assert.equal(t.called.share,0);
});
test('navigation while PDF generation is pending never opens native sharing',async()=>{
  const job=deferred(),t=setup({print:()=>{t.called.print++;return job.promise;}});
  const task=exportPdfWithLifecycleGuard(t.ports);
  t.cancel();job.resolve({uri:validUri});
  assert.equal(await task,'cancelled');
  assert.equal(t.called.available,0);assert.equal(t.called.share,0);
});
test('background while availability check is pending cancels before share',async()=>{
  const job=deferred(),t=setup({sharingAvailable:()=>{t.called.available++;return job.promise;}});
  const task=exportPdfWithLifecycleGuard(t.ports);
  await Promise.resolve();t.cancel();job.resolve(true);
  assert.equal(await task,'cancelled');
  assert.equal(t.called.share,0);
});
test('biometric lock transition invalidates pending generation before native sharing',async()=>{
  const pending=deferred(),lock={current:'unlocked'},t=setup({
    print:()=>pending.promise,
    isCurrent:()=>lock.current==='unlocked'
  });
  const task=exportPdfWithLifecycleGuard(t.ports);
  lock.current='locked';
  pending.resolve({uri:validUri});
  assert.equal(await task,'cancelled');
  assert.equal(t.called.available,0);
  assert.equal(t.called.share,0);
});
test('share-sheet unavailability does not attempt share',async()=>{
  const t=setup({sharingAvailable:async()=>{t.called.available++;return false;}});
  assert.equal(await exportPdfWithLifecycleGuard(t.ports),'unavailable');
  assert.equal(t.called.share,0);
});
test('invalid or remote URI cannot reach native sharing',async()=>{
  for(const uri of ['',null,undefined,'https://example.com/export.pdf','content://external/files/1','file:///tmp/no-extension','file:///tmp/other.txt']){
    const t=setup({print:async()=>({uri})});
    assert.equal(await exportPdfWithLifecycleGuard(t.ports),'failed',String(uri));
    assert.equal(t.called.share,0);
    assert.equal(t.called.available,0);
  }
});
test('print failure is contained without a share or credential exposure',async()=>{
  const t=setup({print:async()=>{throw Error('Synthetic PDF printer crash');}});
  assert.equal(await exportPdfWithLifecycleGuard(t.ports),'failed');
  assert.equal(t.called.share,0);
});
test('share failure is reported without a false success',async()=>{
  const t=setup({share:async()=>{throw Error('Synthetic Android chooser failure');}});
  assert.equal(await exportPdfWithLifecycleGuard(t.ports),'failed');
});
test('stale lifecycle after share resolves does not report successful export',async()=>{
  const job=deferred(),t=setup({share:()=>{t.called.share++;return job.promise;}});
  const task=exportPdfWithLifecycleGuard(t.ports);
  await Promise.resolve();await Promise.resolve();
  t.cancel();job.resolve();
  assert.equal(await task,'cancelled');
  assert.equal(t.called.share,1,'a native chooser already opened cannot be revoked');
});
test('throwing authorization predicate fails closed',async()=>{
  const t=setup({isCurrent:()=>{throw Error('AppState unavailable');}});
  assert.equal(await exportPdfWithLifecycleGuard(t.ports),'cancelled');
  assert.equal(t.called.print,0);assert.equal(t.called.share,0);
});
test('new user intent invalidates earlier pending print job',async()=>{
  const oldJob=deferred(),tokens={current:0},shares=[];
  const first=exportPdfWithLifecycleGuard({
    html:'<h1>Synthetic old report</h1>',
    print:()=>oldJob.promise,
    sharingAvailable:async()=>true,
    share:async uri=>shares.push(uri),
    isCurrent:()=>tokens.current===0
  });
  tokens.current++;
  const second=await exportPdfWithLifecycleGuard({
    html:'<h1>Synthetic new report</h1>',
    print:async()=>({uri:validUri}),
    sharingAvailable:async()=>true,
    share:async uri=>shares.push(uri),
    isCurrent:()=>tokens.current===1
  });
  oldJob.resolve({uri:validUri});
  assert.equal(await first,'cancelled');
  assert.equal(second,'shared');
  assert.deepEqual(shares,[validUri]);
});
test('App wiring invalidates on biometric lock, edited report inputs and app background',()=>{
  const app=readFileSync(new URL('../apps/mobile/App.tsx',import.meta.url),'utf8');
  assert.match(app,/exportPdfWithLifecycleGuard\(\{/);
  assert.match(app,/isCurrent:\(\)=>reportRequestId\.current===requestId&&AppState\.currentState==='active'/);
  assert.match(app,/lockStatusRef\.current==='off'\|\|lockStatusRef\.current==='unlocked'/);
  assert.match(app,/lockStatusRef\.current=localLock\.status/);
  assert.match(app,/localLock\.status!=='off'&&localLock\.status!=='unlocked'/);
  assert.match(app,/reportRequestId\.current\+\+;const result=inspectBoleto\(boletoLine\)/);
  assert.match(app,/cnpjRequestId\.current\+\+;reportRequestId\.current\+\+;setCnpj\(v\)/);
  assert.match(app,/if\(cnpjRequestId\.current===requestId\)\{reportRequestId\.current\+\+;setCnpjResult\(result\)/);
  assert.match(app,/if\(shouldClearSensitiveOnAppState\(nextState\)\)\{/);
  assert.match(app,/if\(page==='Guardião'\)clearCurrentAnalysis\(\)/);
});
