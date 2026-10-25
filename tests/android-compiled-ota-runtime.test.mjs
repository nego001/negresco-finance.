import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,rmSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const script=resolve('tooling/android/verify_compiled_ota_runtime.py');
const version='3.1.3',rid='0x7f120045',name='expo.modules.updates.EXPO_RUNTIME_VERSION';
const manifest=[
 'E: manifest (line=2)',
 '  E: application (line=8)',
 '    E: meta-data (line=21)',
 '      A: android:name(0x01010003)="'+name+'" (Raw: "'+name+'")',
 '      A: android:value(0x01010024)=@'+rid+' (Raw: "@string/expo_runtime_version")',
 '    E: activity (line=27)'
].join('\n');
const resources=[
 'Binary APK',
 'Package name=com.negresco.finance id=7f',
 '  type string id=12 entryCount=99',
 '    resource '+rid+' string/expo_runtime_version',
 '      () "3.1.3"',
 '    resource 0x7f120046 string/app_name',
 '      () "Negresco Finance"'
].join('\n');
function trial(t,mod={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-compiled-runtime-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const apk=join(dir,'test.apk');
  const aapt2=join(dir,'aapt2');
  const zip=spawnSync('python3',['-c',[
    'import sys,zipfile,warnings',
    'warnings.filterwarnings("ignore",category=UserWarning)',
    'with zipfile.ZipFile(sys.argv[1],"w") as archive:',
    ' archive.writestr("AndroidManifest.xml",b"ABCDEFGH")',
    ' archive.writestr("resources.arsc",b"ABCDEFGH")',
    ' if sys.argv[2]=="duplicate": archive.writestr("resources.arsc",b"ABCDEFGH")'
  ].join('\n'),apk,mod.duplicate?'duplicate':'safe'],{encoding:'utf8'});
  assert.equal(zip.status,0,zip.stderr);
  writeFileSync(aapt2,[
    '#!/usr/bin/env python3',
    'import os,sys',
    'if sys.argv[1:3]!=["dump","xmltree"] and sys.argv[1:3]!=["dump","resources"]: sys.exit(70)',
    'if sys.argv[2]=="xmltree":',
    ' if sys.argv[4:]!=["--file","AndroidManifest.xml"]:sys.exit(71)',
    ' print(os.environ["TEST_MANIFEST"])',
    'else: print(os.environ["TEST_RESOURCES"])'
  ].join('\n')+'\n',{mode:0o755});
  chmodSync(aapt2,0o755);
  return {dir,apk,aapt2,manifest:mod.manifest??manifest,
    resources:mod.resources??resources,version:mod.version??version};
}
function run(f){
  return spawnSync('python3',[script,f.apk,f.aapt2,f.version],{
    encoding:'utf8',timeout:10000,env:{...process.env,TEST_MANIFEST:f.manifest,TEST_RESOURCES:f.resources}
  });
}
function allows(f){
  const r=run(f);assert.equal(r.status,0,r.stderr+r.stdout);
  assert.match(r.stdout,/exactly one nonlocalized value/);
}
function rejects(f,msg){
  const r=run(f);assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.match(r.stderr,msg);
}
test('AAPT2 manifest resource ID must map to one default nonlocalized runtime',t=>allows(trial(t)));
test('AAPT2 accepts canonical string8 and string16 renderings',t=>{
  const f=trial(t,{resources:resources.replace('() "3.1.3"','() (string8) "3.1.3"')});
  allows(f);
  allows(trial(t,{resources:resources.replace('() "3.1.3"','() (string16) "3.1.3"')}));
});
test('compiled runtime guard rejects French locale override',t=>{
  rejects(trial(t,{resources:resources.replace('() "3.1.3"','() "3.1.3"\n      (fr) "9.9.9"')}),/exactly one default nonlocalized/);
});
test('compiled runtime guard rejects even identical localized duplicate',t=>{
  rejects(trial(t,{resources:resources.replace('() "3.1.3"','() "3.1.3"\n      (pt-rBR) "3.1.3"')}),/exactly one default nonlocalized/);
});
test('compiled runtime guard rejects package resource version mismatch',t=>{
  rejects(trial(t,{resources:resources.replace('() "3.1.3"','() "1.0.0"')}),/exactly one default nonlocalized/);
});
test('compiled runtime guard rejects a substituted resource ID',t=>{
  rejects(trial(t,{resources:resources.replace(rid,'0x7f120099')}),/resource ID disagree/);
});
test('compiled runtime guard rejects renamed resource',t=>{
  rejects(trial(t,{resources:resources.replace('string/expo_runtime_version','string/other_runtime')}),/resource ID disagree/);
});
test('compiled runtime guard rejects duplicate table definitions',t=>{
  const dup='    resource '+rid+' string/expo_runtime_version\n      () "3.1.3"';
  rejects(trial(t,{resources:resources+'\n'+dup}),/duplicated compiled OTA runtime resource/);
});
test('compiled runtime guard rejects missing runtime meta-data',t=>{
  rejects(trial(t,{manifest:manifest.replaceAll('EXPO_RUNTIME_VERSION','MISSING_RUNTIME')}),/exactly one compiled application/);
});
test('compiled runtime guard rejects literal AndroidManifest runtime instead of a resource',t=>{
  rejects(trial(t,{manifest:manifest.replace('@'+rid+' (Raw: "@string/expo_runtime_version")','"3.1.3"')}),/typed resource reference/);
});
test('compiled runtime guard rejects duplicated runtime metadata',t=>{
  const d=manifest.replace('    E: activity (line=27)',
    manifest.split('\n').slice(2,5).join('\n')+'\n    E: activity (line=27)');
  rejects(trial(t,{manifest:d}),/exactly one compiled application/);
});
test('compiled runtime guard rejects conflicting version command argument',t=>{
  rejects(trial(t,{version:'3.1.2'}),/exactly one default nonlocalized/);
});
test('compiled runtime guard rejects invalid version format',t=>{
  rejects(trial(t,{version:'anything goes'}),/explicit pinned appVersion/);
});
test('compiled runtime guard rejects malformed resources configuration',t=>{
  rejects(trial(t,{resources:resources.replace('() "3.1.3"','() @0x7f000000')}),/unexpected or indirect OTA runtime table value/);
});
test('compiled runtime guard rejects duplicate resources.arsc archive entries',t=>{
  rejects(trial(t,{duplicate:true}),/resources.arsc must be unique/);
});
test('compiled runtime audit must execute before APK artifact upload',()=>{
  const wf=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
  const segment=wf.slice(wf.indexOf('  build-test-apk:'),wf.indexOf('  publish-test-prerelease:'));
  const check=segment.indexOf('      - name: Audit compiled Expo OTA runtime resource');
  const upload=segment.indexOf('      - name: Upload standalone APK');
  assert.ok(check>=0&&upload>check);
  assert.match(segment,/verify_compiled_ota_runtime\.py "\$APK" "\$BUILD_TOOLS\/aapt2"/);
  assert.match(wf,/tooling\/android\/verify_compiled_ota_runtime\.py/);
  assert.match(wf,/tests\/android-compiled-ota-runtime\.test\.mjs/);
});
