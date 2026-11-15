import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPdfNativeExportGate} from '../apps/mobile/guardiao/pdfSingleFlight.ts';
import {exportPdfWithLifecycleGuard} from '../apps/mobile/guardiao/pdfExport.ts';

const app=readFileSync('apps/mobile/App.tsx','utf8');

test('slow PDF warning is read-only, bounded, accessible and never unlocks native print',()=>{
 const start=app.indexOf('  const [reportPdfLongPending,setReportPdfLongPending]=useState(false);');
 const end=app.indexOf('  // Debug-only observation:',start);
 assert.ok(start>=0&&end>start,'separate warning state and lifecycle hook required');
 const hook=app.slice(start,end);
 assert.match(hook,/if\(!reportPdfBusy\)return/);
 assert.match(hook,/const noticeTimer=setTimeout\(\(\)=>\{/);
 assert.match(hook,/if\(pdfNativeGate\.current\.busy\(\)\)setReportPdfLongPending\(true\)/);
 assert.match(hook,/\},30000\)/);
 assert.match(hook,/return \(\)=>clearTimeout\(noticeTimer\)/);
 assert.doesNotMatch(hook,/releasePdfGate|pdfNativeGate\.current\.acquire|Print\.printToFileAsync|Sharing\.shareAsync|Promise\.race|setReportPdfBusy\(false\)/);
 const warning=app.slice(app.indexOf('        {reportPdfBusy&&reportPdfLongPending&&'),app.indexOf('        {typeof __DEV__',app.indexOf('        {reportPdfBusy&&reportPdfLongPending&&')));
 assert.match(warning,/reportPdfBusy&&reportPdfLongPending&&pdfNativeGate\.current\.busy\(\)/);
 assert.match(warning,/accessibilityLiveRegion="polite"/);
 assert.match(warning,/O arquivo ainda não foi confirmado/);
 assert.match(warning,/Outra exportação permanece bloqueada/);
 assert.doesNotMatch(warning,/compartilhado com sucesso|arquivo gerado com sucesso|boletoLine|cnpjResult|pdf\.uri|console\.|setTimeout|releasePdfGate/);
 const flow=app.slice(app.indexOf('  const exportLocalPdf=async()=>{'),app.indexOf('  const [guardiaoHistory'));
 assert.match(flow,/finally\{[\s\S]*?releasePdfGate\(\);\s*setReportPdfBusy\(false\);\s*setReportPdfLongPending\(false\);/);
 assert.doesNotMatch(flow,/Promise\.race|setTimeout|clearTimeout/);
});

test('a warning for an unresolved synthetic print cannot yield share or enable another native print',async()=>{
 const gate=createPdfNativeExportGate();
 let done;
 const native=new Promise(resolve=>{done=resolve;});
 let attempts=0,shares=0,authorized=true;
 const run=async()=>{
  const release=gate.acquire();
  if(!release)return 'already-running';
  try {
   return await exportPdfWithLifecycleGuard({
    html:'<html>Synthetic text only</html>',
    print:()=>{attempts++;return native;},
    sharingAvailable:async()=>true,
    share:async()=>{shares++;},
    isCurrent:()=>authorized
   });
  } finally {release();}
 };
 const first=run();
 assert.equal(gate.busy(),true);
 assert.equal(await run(),'already-running');
 assert.equal(attempts,1);
 assert.equal(shares,0);
 authorized=false;
 assert.equal(gate.busy(),true,'UI-only warning and revoked token cannot cancel native print');
 done({uri:'file:///private/synthetic.pdf'});
 assert.equal(await first,'cancelled');
 assert.equal(shares,0);
 assert.equal(gate.busy(),false);
});
