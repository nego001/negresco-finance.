import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const sourcePath=resolve('tooling/android/verify_packaged_expo_config.py');
const source=readFileSync(sourcePath,'utf8');
const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
const job=workflow.slice(workflow.indexOf('  verify-downloaded-ota-runtime:'),
                         workflow.indexOf('  publish-test-prerelease:'));
const stepName='      - name: Independently cross-check downloaded Expo app.config OTA asset';
const step=job.slice(job.indexOf(stepName));
const match=/python3 - "\$APK" <<'PY'\r?\n([\s\S]*?)^          PY$/m.exec(step);
assert.ok(match,'workflow must embed an independent trusted asset auditor');
const inline=match[1].split(/\r?\n/).map(x=>x.startsWith('          ')?x.slice(10):x).join('\n').trimEnd()+'\n';

const projectId='a506611f-a159-4341-bed7-28dcbd47bf95';
const valid={
  name:'Negresco Finance',
  version:'3.1.3',sdkVersion:'54.0.0',platforms:['ios','android'],
  runtimeVersion:{policy:'appVersion'},owner:'negresco-finance',
  android:{package:'com.negresco.finance',versionCode:34,allowBackup:false},
  extra:{eas:{projectId}},
  updates:{
    enabled:true,checkAutomatically:'ON_LOAD',fallbackToCacheTimeout:0,
    url:'https://u.expo.dev/'+projectId,
    requestHeaders:{'expo-channel-name':'preview'}
  }
};
function modify(updater){
  const v=JSON.parse(JSON.stringify(valid));
  updater(v);
  return v;
}
function fixture(t,obj=valid,opts={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-ota-appconfig-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const apk=join(dir,'candidate.apk');
  const config=join(dir,'payload.json');
  writeFileSync(config,opts.raw??JSON.stringify(obj));
  const python=[
    'import sys,zipfile,stat',
    'with zipfile.ZipFile(sys.argv[1],"w") as z:',
    ' name="assets/app.config" if sys.argv[3]!="missing" else "assets/missing.config"',
    ' if sys.argv[3]=="symlink":',
    '  info=zipfile.ZipInfo("assets/app.config"); info.create_system=3',
    '  info.external_attr=(stat.S_IFLNK | 0o777)<<16',
    '  z.writestr(info,b"../../config")',
    ' else: z.write(sys.argv[2],name)',
    ' if sys.argv[3]=="duplicate": z.write(sys.argv[2],"assets/app.config")'
  ].join('\n');
  const p=spawnSync('python3',['-c',python,apk,config,opts.mode??'normal'],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  return apk;
}
function run(apk,inWorkflow){
  return spawnSync('python3',inWorkflow?['-',apk]:[sourcePath,apk],{
    input:inWorkflow?inline:undefined,encoding:'utf8',timeout:10000
  });
}
function allow(apk){
  for(const embedded of [false,true]){
    const p=run(apk,embedded);
    assert.equal(p.status,0,p.stderr+p.stdout);
    assert.match(p.stdout,/packaged Expo config agrees with pinned preview OTA lab policy/);
  }
}
function deny(apk,pattern){
  for(const embedded of [false,true]){
    const p=run(apk,embedded);
    assert.notEqual(p.status,0,p.stdout+p.stderr);
    assert.match(p.stderr,pattern);
  }
}
test('independent inline asset verifier matches the source exactly',()=>{
  assert.equal(inline,source);
  assert.match(workflow,/tooling\/android\/verify_packaged_expo_config\.py/);
  assert.match(workflow,/tests\/android-downloaded-expo-config-consistency\.test\.mjs/);
});
test('asset check is after APK integrity/signature, runtime and compiled preview audit',()=>{
  assert.ok(job.indexOf(stepName)>job.indexOf('      - name: Audit downloaded compiled Expo preview channel (read only)'));
  assert.match(job,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(job,/actions\/checkout|contents: write|secrets\./);
  assert.match(job,/name: negresco-finance-v313-test-apk/);
  const pub=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
  assert.match(pub,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
});
test('valid Expo SDK 54 lab preview app.config in downloaded APK passes',t=>allow(fixture(t)));
test('reject OTA production/staging/other channel in secondary asset',t=>{
  for(const channel of ['production','staging','development'])
    deny(fixture(t,modify(c=>c.updates.requestHeaders['expo-channel-name']=channel)),/channel must be preview only/);
});
test('reject extra OTA request headers in secondary asset',t=>{
  deny(fixture(t,modify(c=>c.updates.requestHeaders.authorization='Bearer x')),/channel must be preview only/);
});
test('reject Expo OTA endpoint/project identity mismatch',t=>{
  deny(fixture(t,modify(c=>c.updates.url='https://u.expo.dev/unexpected')),/endpoint differs/);
  deny(fixture(t,modify(c=>c.extra.eas.projectId='wrong-project')),/EAS project identity/);
});
test('reject changed OTA signing fields and unrecognized update options',t=>{
  deny(fixture(t,modify(c=>c.updates.codeSigningCertificate='certificate.pem')),/updates keys are missing or unexpected/);
  deny(fixture(t,modify(c=>c.updates.codeSigningMetadata={keyid:'injected'})),/updates keys are missing or unexpected/);
});
test('reject disabled updates or modified launch timing semantics',t=>{
  deny(fixture(t,modify(c=>c.updates.enabled=false)),/enabling\/check\/fallback policy drift/);
  deny(fixture(t,modify(c=>c.updates.checkAutomatically='NEVER')),/enabling\/check\/fallback policy drift/);
  deny(fixture(t,modify(c=>c.updates.fallbackToCacheTimeout=5000)),/enabling\/check\/fallback policy drift/);
});
test('reject changed version/runtime, Android package/versionCode and backups',t=>{
  deny(fixture(t,modify(c=>c.version='9.9.9')),/version\/runtimeVersion/);
  deny(fixture(t,modify(c=>c.runtimeVersion={policy:'sdkVersion'})),/version\/runtimeVersion/);
  deny(fixture(t,modify(c=>c.android.package='com.evil.finance')),/Android identity\/version\/backup/);
  deny(fixture(t,modify(c=>c.android.versionCode=0)),/Android identity\/version\/backup/);
  deny(fixture(t,modify(c=>c.android.allowBackup=true)),/Android identity\/version\/backup/);
});
test('reject unrelated Expo SDK, owner or platform identity',t=>{
  deny(fixture(t,modify(c=>c.sdkVersion='55.0.0')),/SDK\/platforms/);
  deny(fixture(t,modify(c=>c.owner='other')),/Expo owner changed/);
  deny(fixture(t,modify(c=>c.platforms=['android'])),/SDK\/platforms/);
});
test('reject JSON duplicate keys and malformed JSON',t=>{
  const dup=JSON.stringify(valid).replace('"version":"3.1.3"','"version":"3.1.3","version":"3.1.3"');
  deny(fixture(t,valid,{raw:dup}),/duplicated JSON key/);
  deny(fixture(t,valid,{raw:'{"version":'}),/invalid JSON encoding or structure/);
});
test('reject duplicate, missing or symlinked assets/app.config entries',t=>{
  deny(fixture(t,valid,{mode:'duplicate'}),/one unique assets\/app.config/);
  deny(fixture(t,valid,{mode:'missing'}),/one unique assets\/app.config/);
  deny(fixture(t,valid,{mode:'symlink'}),/ZIP entry is unsafe/);
});
test('reject linked or missing APK',t=>{
  const apk=fixture(t),link=join(apk.replace(/candidate\.apk$/,''),'link.apk');
  symlinkSync(apk,link);
  deny(link,/APK is missing, linked or oversized/);
  rmSync(apk);
  deny(apk,/APK is missing, linked or oversized/);
});
test('reject oversized config ZIP entry',t=>{
  deny(fixture(t,valid,{raw:' '.repeat(65537)}),/ZIP entry is unsafe/);
});
