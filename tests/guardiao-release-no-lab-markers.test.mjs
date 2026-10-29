import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const script='tooling/android/verify_guardiao_release_no_lab_markers.py';
const workflow=readFileSync('.github/workflows/android-apk.yml','utf8');

function withTemp(fn){
  const dir=mkdtempSync(join(tmpdir(),'negresco-lab-bundle-'));
  try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}
}
function makeFakeApk(dir,bundle,duplicates=false){
  const apk=join(dir,'synthetic.apk');
  const script= [
    'import sys,zipfile',
    'apk=sys.argv[1];content=sys.argv[2].encode("utf-8")',
    'with zipfile.ZipFile(apk,"w",zipfile.ZIP_DEFLATED) as z:',
    ' z.writestr("assets/index.android.bundle",content)',
    ...(duplicates?[' z.writestr("assets/index.android.bundle",content)']:[])
  ].join('\n');
  const result=spawnSync('python3',['-c',script,apk,bundle],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  return apk;
}
const verify=apk=>spawnSync('python3',[script,apk],{encoding:'utf8',timeout:15000});

test('realistic synthetic Release JS bundle passes only without lab marker',()=>withTemp(dir=>{
  const apk=makeFakeApk(dir,'Gerando PDF local... onPendingPhase __DEV__');
  const run=verify(apk);
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/PASS \(LAB\): Release APK/);
}));

test('leaked debug-only label is always BLOCK, not a warning',()=>withTemp(dir=>{
  for(const marker of ['Gerando PDF local... [LAB: impressão pendente]',
                       'Gerando PDF local... [LAB: disponibilidade pendente]',
                       'Gerando PDF local... [LAB: compartilhamento pendente]']){
    const apk=makeFakeApk(dir,marker);
    const run=verify(apk);
    assert.equal(run.status,1,marker);
    assert.match(run.stderr,/BLOCK \(LAB\)/);
    assert.doesNotMatch(run.stderr,/impressão|disponibilidade|compartilhamento/);
  }
}));

test('missing or duplicated bundle and non-ZIP file fail closed',()=>withTemp(dir=>{
  const dup=makeFakeApk(dir,'clean',true);
  assert.equal(verify(dup).status,1);
  const notzip=join(dir,'not-an-apk.apk');
  writeFileSync(notzip,'0'.repeat(200));
  assert.equal(verify(notzip).status,1);
  const missing=join(dir,'missing.apk');
  assert.equal(verify(missing).status,1);
}));

test('build verifies actual assembled Release APK before artifact publication',()=>{
  assert.match(workflow,/name: Audit Release APK for Guardiao debug-only UI labels/);
  assert.match(workflow,/python3 \.\.\/\.\.\/tooling\/android\/verify_guardiao_release_no_lab_markers\.py android\/app\/build\/outputs\/apk\/release\/app-release\.apk/);
  const gate=workflow.indexOf('name: Audit Release APK for Guardiao debug-only UI labels');
  const artifact=workflow.indexOf('name: Preserve full release bundle as Actions artifact');
  assert.ok(gate>0 && artifact>gate);
  assert.match(workflow,/if: \$\{\{ github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing \}\}/);
  const source=readFileSync(script,'utf8');
  assert.match(source,/FORBIDDEN = \(b"\[LAB:", "\[LAB:"\.encode\("utf-16le"\)\)/);
  assert.match(source,/handle\.read\(MAX_BUNDLE \+ 1\)/);
  assert.doesNotMatch(source,/extractall|write_bytes|\.extract\(/);
});
