import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const verifier=fileURLToPath(new URL('../tooling/android/verify_compiled_backup_policy.py',import.meta.url));
const domains=['root','file','database','sharedpref','external',
  'device_root','device_file','device_database','device_sharedpref'];
const modernName='res/A7.xml',legacyName='res/A8.xml';
const manifest=[
  'E: manifest (line=1)',
  '  E: application (line=2)',
  '    A: android:dataExtractionRules(0x01010634)=@0x7f150001',
  '    A: android:fullBackupContent(0x010104eb)=@0x7f150002',
  '    E: activity (line=9)'
].join('\n');
const resources=[
  'resource 0x7f150001 com.negresco.finance:xml/negresco_no_data_extraction',
  '  () (file) '+modernName+' type=XML',
  'resource 0x7f150002 com.negresco.finance:xml/negresco_legacy_no_backup',
  '  () (file) '+legacyName+' type=XML'
].join('\n');
const ex=(indent,domain,path='.')=>[
  indent+'E: exclude (line=4)',
  indent+'  A: domain="'+domain+'" (Raw: "'+domain+'")',
  indent+'  A: path="'+path+'" (Raw: "'+path+'")'
].join('\n');
const modern=[
  'E: data-extraction-rules (line=2)',
  '  E: cloud-backup (line=3)',
  '    A: disableIfNoEncryptionCapabilities=true',
  ...domains.map(x=>ex('    ',x)),
  '  E: device-transfer (line=14)',
  ...domains.map(x=>ex('    ',x))
].join('\n');
const legacy=[
  'E: full-backup-content (line=2)',
  ...domains.map(x=>ex('  ',x))
].join('\n');
function execute(t,override={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-backup-compiled-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const apk=join(dir,'test.apk'),aapt2=join(dir,'aapt2');
  const mkzip=[
    'import sys,zipfile',
    "with zipfile.ZipFile(sys.argv[1],'w') as z:",
    " z.writestr(sys.argv[2],b'modern')",
    " z.writestr(sys.argv[3],b'legacy')",
    " if sys.argv[4]=='true': z.writestr(sys.argv[2],b'evil')"
  ].join('\n');
  const z=spawnSync('python3',['-c',mkzip,apk,
    override.modernEntry??modernName,override.legacyEntry??legacyName,
    override.duplicate?'true':'false'],{encoding:'utf8'});
  assert.equal(z.status,0,z.stderr);
  writeFileSync(aapt2,[
    '#!/usr/bin/env python3',
    'import os,sys',
    "if sys.argv[1:3]==['dump','resources']:",
    " print(os.environ['POLICY_RESOURCES'])",
    "elif sys.argv[1:3]==['dump','xmltree']:",
    " path=sys.argv[4:]",
    " if path==['--file','AndroidManifest.xml']: print(os.environ['POLICY_MANIFEST'])",
    " elif path==['--file','res/A7.xml']: print(os.environ['POLICY_MODERN'])",
    " elif path==['--file','res/A8.xml']: print(os.environ['POLICY_LEGACY'])",
    ' else: sys.exit(34)',
    'else: sys.exit(35)'
  ].join('\n')+'\n',{mode:0o755});
  chmodSync(aapt2,0o755);
  return spawnSync('python3',[verifier,apk,aapt2],{
    encoding:'utf8',timeout:10000,
    env:{...process.env,
      POLICY_RESOURCES:override.resources??resources,
      POLICY_MANIFEST:override.manifest??manifest,
      POLICY_MODERN:override.modern??modern,
      POLICY_LEGACY:override.legacy??legacy}
  });
}
function fails(t,options,message){
  const out=execute(t,options);
  assert.notEqual(out.status,0,out.stdout+out.stderr);
  assert.match(out.stdout+out.stderr,message);
}

test('APK cloud, device-transfer and legacy policies exclude all 9 domains',t=>{
  const out=execute(t);
  assert.equal(out.status,0,out.stderr+out.stdout);
  assert.match(out.stdout,/denies cloud backup, device transfer and legacy full backup/);
});
test('AAPT2 raw forms for domains, dot-path and Boolean true are accepted only when exact',t=>{
  const raw=modern.replaceAll('true','"true" (Raw: "true")')
    .replaceAll('domain="root" (Raw: "root")','domain=root')
    .replaceAll('path="." (Raw: ".")','path=.');
  const out=execute(t,{modern:raw});
  assert.equal(out.status,0,out.stderr);
});
for(const [scenario,options,reason] of [
  ['modern manifest reference missing',{manifest:manifest.replace(/.*dataExtractionRules.*\n/,'')},/dataExtractionRules/],
  ['modern reference is a string',{manifest:manifest.replace('@0x7f150001','"@xml/negresco_no_data_extraction"')},/invalid compiled dataExtractionRules/],
  ['legacy manifest reference missing',{manifest:manifest.replace(/.*fullBackupContent.*\n/,'')},/fullBackupContent/],
  ['modern legacy use one ID',{manifest:manifest.replace('fullBackupContent(0x010104eb)=@0x7f150002','fullBackupContent(0x010104eb)=@0x7f150001')},/share one compiled resource/],
  ['resource name replaced',{resources:resources.replace('xml/negresco_no_data_extraction','xml/replaced')},/resource name changed/],
  ['resource path unavailable',{resources:resources.replace(modernName,'unknown')},/resource table path/],
  ['modern zip resource missing',{modernEntry:'res/unrelated.xml'},/XML missing or duplicated/],
  ['duplicate modern zip entry',{duplicate:true},/XML missing or duplicated/],
  ['missing cloud-backup',{modern:modern.replace('E: cloud-backup','E: other-backup')},/cloud\/transfer rules changed/],
  ['reordered sections',{modern:modern.replace('E: cloud-backup','E: replacement').replace('E: device-transfer','E: cloud-backup').replace('E: replacement','E: device-transfer')},/cloud\/transfer rules changed/],
  ['unencrypted cloud allowed',{modern:modern.replace('disableIfNoEncryptionCapabilities=true','disableIfNoEncryptionCapabilities=false')},/encryption capability requirement/],
  ['cloud encryption flag missing',{modern:modern.replace(/.*disableIfNoEncryptionCapabilities.*\n/,'')},/encryption capability requirement/],
  ['cloud domain omitted',{modern:modern.replace(ex('    ','root')+'\n','')},/exactly nine exclusions/],
  ['device transfer domain omitted',{modern:modern.slice(0,modern.lastIndexOf(ex('    ','device_sharedpref')))},/exactly nine exclusions/],
  ['modern domain repeated',{modern:modern.replace('domain="root" (Raw: "root")','domain="file" (Raw: "file")')},/duplicated or unexpected/],
  ['modern path narrows directory',{modern:modern.replace('path="." (Raw: ".")','path="subfolder" (Raw: "subfolder")')},/unsafe exclusion path/],
  ['modern explicit include added',{modern:modern+'\n    E: include (line=90)'},/exactly nine exclusions/],
  ['modern unknown domain',{modern:modern.replace('domain="root" (Raw: "root")','domain="unknown" (Raw: "unknown")')},/duplicated or unexpected/],
  ['legacy domain excluded incompletely',{legacy:legacy.replace(ex('  ','root')+'\n','')},/exactly nine exclusions/],
  ['legacy includes arbitrary files',{legacy:legacy+'\n  E: include (line=90)'},/exactly nine exclusions/],
  ['legacy excludes only some path',{legacy:legacy.replace('path="." (Raw: ".")','path="accounts" (Raw: "accounts")')},/unsafe exclusion path/],
  ['legacy unexpected root',{legacy:legacy.replace('E: full-backup-content','E: allow-backup-content')},/legacy backup policy root/]
]){
  test('compiled backup audit rejects: '+scenario,t=>fails(t,options,reason));
}
test('APK workflow requires this compiled backup audit before any artifact upload',()=>{
  const wf=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
  const build=wf.slice(wf.indexOf('  build-test-apk:'),wf.indexOf('  publish-test-prerelease:'));
  const audit=build.indexOf('verify_compiled_backup_policy.py "$APK" "$BUILD_TOOLS/aapt2"');
  assert.ok(audit>0 && build.indexOf('uses: actions/upload-artifact@v4')>audit);
  assert.match(wf,/tooling\/android\/verify_compiled_backup_policy\.py/);
  assert.match(wf,/tests\/android-compiled-backup-policy\.test\.mjs/);
});
