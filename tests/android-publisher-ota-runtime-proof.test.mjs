import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,chmodSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
const source=readFileSync(resolve('tooling/android/verify_compiled_ota_runtime.py'),'utf8');
const publisher=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const start='      - name: Independently audit downloaded compiled OTA runtime resource';
const before='      - name: Independently audit downloaded compiled OTA policy';
const after='      - name: Stage private draft and publish only after complete verified upload';
const offset=publisher.indexOf(start);
const end=publisher.indexOf(after);
const step=publisher.slice(offset,end);
const match=/python3 - Negresco-Finance-V3\.1\.3-preview\.apk "\$BUILD_TOOLS\/aapt2" 3\.1\.3 <<'PY'\r?\n([\s\S]*?)^          PY$/m.exec(step);
assert.ok(match,'privileged publisher must embed its own Python verifier');
const pythonCode=match[1].split(/\r?\n/).map(line=>line.startsWith('          ')?line.slice(10):line).join('\n').trimEnd()+'\n';
const RID='0x7f120045',VERSION='3.1.3';
const KEY='expo.modules.updates.EXPO_RUNTIME_VERSION';
const goodManifest=[
  'E: manifest (line=2)',
  '  E: application (line=8)',
  '    E: meta-data (line=21)',
  '      A: android:name(0x01010003)="'+KEY+'" (Raw: "'+KEY+'")',
  '      A: android:value(0x01010024)=@'+RID+' (Raw: "@string/expo_runtime_version")',
  '    E: activity (line=27)'
].join('\n');
const goodResources=[
  'Package name=com.negresco.finance id=7f',
  '  type string id=12 entryCount=99',
  '    resource '+RID+' string/expo_runtime_version',
  '      () "3.1.3"',
  '    resource 0x7f120046 string/app_name',
  '      () "Negresco Finance"'
].join('\n');
function fixture(t,changes={}){
  const temp=mkdtempSync(join(tmpdir(),'negresco-privileged-runtime-'));
  t.after(()=>rmSync(temp,{recursive:true,force:true}));
  const bin=join(temp,'signed.apk'),aapt=join(temp,'aapt2');
  const zipCode=[
    'import sys,zipfile,warnings',
    'warnings.filterwarnings("ignore",category=UserWarning)',
    'with zipfile.ZipFile(sys.argv[1],"w") as archive:',
    ' archive.writestr("AndroidManifest.xml",b"ABCDEFGH")',
    ' archive.writestr("resources.arsc",b"ABCDEFGH")',
    ' if sys.argv[2]=="duplicate": archive.writestr("resources.arsc",b"ABCDEFGH")'
  ].join('\n');
  const prep=spawnSync('python3',['-c',zipCode,bin,changes.duplicate?'duplicate':'no'],{encoding:'utf8'});
  assert.equal(prep.status,0,prep.stderr);
  writeFileSync(aapt,[
    '#!/usr/bin/env python3',
    'import os,sys',
    'if sys.argv[1:3]!=["dump","xmltree"] and sys.argv[1:3]!=["dump","resources"]: sys.exit(90)',
    'if sys.argv[2]=="xmltree":',
    ' if sys.argv[4:]!=["--file","AndroidManifest.xml"]: sys.exit(91)',
    ' print(os.environ["MOCK_MANIFEST"])',
    'else: print(os.environ["MOCK_RESOURCES"])'
  ].join('\n')+'\n',{mode:0o755});
  chmodSync(aapt,0o755);
  return {bin,aapt,manifest:changes.manifest??goodManifest,
    resources:changes.resources??goodResources};
}
function execute(f){
  return spawnSync('python3',['-',f.bin,f.aapt,VERSION],{
    encoding:'utf8',input:pythonCode,timeout:10000,
    env:{...process.env,MOCK_MANIFEST:f.manifest,MOCK_RESOURCES:f.resources}
  });
}
function approved(f){
  const p=execute(f);
  assert.equal(p.status,0,p.stderr+p.stdout);
  assert.match(p.stdout,/compiled APK OTA runtime resource 3.1.3/);
}
function denied(f,pattern){
  const p=execute(f);
  assert.notEqual(p.status,0,p.stderr+p.stdout);
  assert.match(p.stderr,pattern);
}
test('privileged publisher carries an exact inline copy of the compiled verifier',()=>{
  assert.equal(pythonCode,source,'publisher may not trust file scripts supplied by an artifact');
  assert.ok(offset>publisher.indexOf(before) && end>offset);
  assert.doesNotMatch(publisher,/actions\/checkout@/);
  assert.match(publisher,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing/);
});
test('privileged auditor approves an exact nonlocalized 3.1.3 compiled resource',t=>approved(fixture(t)));
test('privileged auditor blocks a localized OTA runtime in downloaded APK',t=>{
  denied(fixture(t,{resources:goodResources.replace('() "3.1.3"','() "3.1.3"\n      (pt-rBR) "9.9.9"')}),
    /exactly one default nonlocalized value/);
});
test('privileged auditor blocks a different runtime in APK resources',t=>{
  denied(fixture(t,{resources:goodResources.replace('() "3.1.3"','() "3.1.2"')}),
    /exactly one default nonlocalized value/);
});
test('privileged auditor blocks altered manifest ID',t=>{
  denied(fixture(t,{manifest:goodManifest.replace('@'+RID,'@0x7f120055')}),
    /resource ID disagree/);
});
test('privileged auditor blocks missing runtime metadata in manifest',t=>{
  denied(fixture(t,{manifest:goodManifest.replaceAll(KEY,'expo.modules.updates.WRONG')}),
    /exactly one compiled application OTA runtime reference/);
});
test('privileged auditor blocks duplicate resources.arsc in downloaded artifact',t=>{
  denied(fixture(t,{duplicate:true}),/resources.arsc must be unique/);
});
test('privileged auditor blocks duplicate runtime definitions',t=>{
  const conflict='\n    resource '+RID+' string/expo_runtime_version\n      () "3.1.3"';
  denied(fixture(t,{resources:goodResources+conflict}),/duplicated compiled OTA runtime resource/);
});
test('privileged auditor runs after other download checks and before creating a draft release',()=>{
  const backup=publisher.indexOf('      - name: Independently audit downloaded compiled backup XML');
  const ota=publisher.indexOf('      - name: Independently audit downloaded compiled OTA policy');
  assert.ok(backup>0 && ota>backup && offset>ota && end>offset);
  assert.match(step,/test -x "\$BUILD_TOOLS\/aapt2"/);
  assert.match(workflow,/tests\/android-publisher-ota-runtime-proof\.test\.mjs/);
});
