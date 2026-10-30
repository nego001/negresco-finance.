import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {exportPdfWithLifecycleGuard} from '../apps/mobile/guardiao/pdfExport.ts';

const uri='file:///private/lab/synthetic.pdf';
const synthetic='SYNTHETIC_PRIVATE_HTML_NEVER_EXPOSE';

test('optional observer emits only fixed pending stages in native await order',async()=>{
  const stages=[],events=[];
  const out=await exportPdfWithLifecycleGuard({
    html:synthetic,
    isCurrent:()=>true,
    onPendingPhase:stage=>{stages.push(stage);events.push('notice:'+stage);},
    print:async html=>{assert.equal(html,synthetic);events.push('print');return {uri};},
    sharingAvailable:async()=>{events.push('available');return true;},
    share:async arg=>{assert.equal(arg,uri);events.push('share');}
  });
  assert.equal(out,'shared');
  assert.deepEqual(stages,['print','availability','share']);
  assert.deepEqual(events,['notice:print','print','notice:availability','available','notice:share','share']);
  assert.doesNotMatch(stages.join('|'),/SYNTHETIC_PRIVATE|private\/lab|file:/);
});

test('failing, throwing, cancelled observers cannot promote a failure or weaken lifecycle gates',async()=>{
  const notices=[];
  const ports={
    html:synthetic,
    isCurrent:()=>true,
    onPendingPhase:phase=>{notices.push(phase);throw Error('synthetic observer failed');},
    print:async()=>({uri}),
    sharingAvailable:async()=>true,
    share:async()=>{throw Error('synthetic share failed');}
  };
  assert.equal(await exportPdfWithLifecycleGuard(ports),'failed');
  assert.deepEqual(notices,['print','availability','share']);

  let allowed=false,native=0;
  assert.equal(await exportPdfWithLifecycleGuard({
    ...ports,isCurrent:()=>allowed,
    print:async()=>{native++;return {uri};},
    share:async()=>{native++;}
  }),'cancelled');
  assert.equal(native,0);
  assert.deepEqual(notices,['print','availability','share']);
});


test('pending-stage observer cannot revoke authorization and still start a native operation',async()=>{
  for(const revokeAt of ['print','availability','share']){
    let allowed=true;
    const seen=[],called={print:0,available:0,share:0,discard:0};
    const result=await exportPdfWithLifecycleGuard({
      html:synthetic,
      isCurrent:()=>allowed,
      onPendingPhase:stage=>{
        seen.push(stage);
        if(stage===revokeAt)allowed=false;
      },
      print:async()=>{called.print++;return {uri};},
      sharingAvailable:async()=>{called.available++;return true;},
      share:async()=>{called.share++;},
      discardUnsharedFile:async()=>{called.discard++;return true;}
    });
    assert.equal(result,'cancelled',revokeAt);
    const expected={
      print:{print:0,available:0,share:0,discard:0},
      availability:{print:1,available:0,share:0,discard:1},
      share:{print:1,available:1,share:0,discard:1}
    }[revokeAt];
    assert.deepEqual(called,expected,revokeAt);
    assert.equal(seen.at(-1),revokeAt);
  }
});

test('throwing isCurrent during observer recheck fails closed before native call',async()=>{
  let checks=0,printCalled=0,stageCalled=0;
  const result=await exportPdfWithLifecycleGuard({
    html:synthetic,
    isCurrent:()=>++checks<3?true:(()=>{throw Error('synthetic lifecycle invalid');})(),
    onPendingPhase:()=>{stageCalled++;},
    print:async()=>{printCalled++;return {uri};},
    sharingAvailable:async()=>true,
    share:async()=>{}
  });
  assert.equal(result,'cancelled');
  assert.equal(stageCalled,1);
  assert.equal(printCalled,0);
});

test('source exposes debug-only phase UI without user data, and old APK remains pinned',()=>{
  const app=readFileSync('apps/mobile/App.tsx','utf8');
  const pdf=readFileSync('apps/mobile/guardiao/pdfExport.ts','utf8');
  const workflow=readFileSync('.github/workflows/guardiao-android-collection48-pdf-text-lab.yml','utf8');
  assert.match(app,/if\(typeof __DEV__==='undefined'\|\|!__DEV__\)return/);
  assert.match(app,/onPendingPhase:stage=>/);
  assert.match(app,/reportRequestId\.current!==requestId/);
  assert.match(pdf,/onPendingPhase\?:\(phase:PdfExportPendingPhase\)=>void/);
  assert.match(pdf,/try\{ports\.onPendingPhase\?\.\(stage\);\}catch/);
  assert.match(pdf,/if\(!reportPending\('print'\)\)return 'cancelled'/);
  assert.match(pdf,/if\(!reportPending\('availability'\)\)return 'cancelled'/);
  assert.match(pdf,/if\(!reportPending\('share'\)\)return 'cancelled'/);
  assert.match(workflow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
  assert.doesNotMatch(app,/console\.log\(.*labPendingLabels|JSON\.stringify\(.*reportExportStatus/);
});

test('offline classifier recognizes debug-only fixed phase hints, rejects unknown input',()=>{
  const py=[
    "import importlib.util",
    "spec=importlib.util.spec_from_file_location('lab','tooling/android/guardiao_pdf_ui_emulator_smoke.py')",
    "lab=importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(lab)",
    "env={'appProcessAlive':True,'foregroundCategory':'negresco-app'}",
    "for label,expected in [('impressão pendente','lab-print-pending'),('disponibilidade pendente','lab-availability-pending'),('compartilhamento pendente','lab-share-pending')]:",
    "    ui={'Gerando PDF local...':True,'Gerando PDF local... [LAB: '+label+']':True}",
    "    assert lab.pdf_timeout_category(ui,env)==expected",
    "assert lab.pdf_timeout_category({'Gerando PDF local...':True},env)=='ui-loading-app-foreground'",
    "assert lab.pdf_timeout_category({'Gerando PDF local... [LAB: impressão pendente]':True},{'appProcessAlive':True,'foregroundCategory':'unknown'})=='unclassified'",
    "print('PASS fixed synthetic boundary hints')"
  ].join('\n');
  const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/PASS fixed synthetic boundary hints/);
});
