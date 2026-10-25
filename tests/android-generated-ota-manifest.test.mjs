import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const verifier=resolve('tooling/android/verify_generated_ota_manifest.py');
const pem='-----BEGIN CERTIFICATE-----\nYQ==\n-----END CERTIFICATE-----\n';
const appUpdates={
  enabled:true,
  url:'https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95',
  requestHeaders:{'expo-channel-name':'production'},
  codeSigningCertificate:'./certs/certificate.pem',
  codeSigningMetadata:{alg:'rsa-v1_5-sha256',keyid:'main'}
};
const pref='expo.modules.updates.';
function escapeXml(value){
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
    .replace(/\r/g,'&#13;').replace(/\n/g,'&#10;');
}
function tag(name,value){
  return '<meta-data android:name="'+escapeXml(pref+name)+'" android:value="'+escapeXml(value)+'"/>';
}
function manifest(items=[]){
  return '<?xml version="1.0" encoding="utf-8"?>\n'
    +'<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.negresco.finance">'
    +'<application>'+items.join('')+'</application></manifest>';
}
function normalSignedTags(){
  return [tag('ENABLED','true'),tag('CODE_SIGNING_CERTIFICATE',pem),
    tag('CODE_SIGNING_METADATA',JSON.stringify(appUpdates.codeSigningMetadata)),
    tag('EXPO_UPDATE_URL',appUpdates.url),
    tag('UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',JSON.stringify(appUpdates.requestHeaders))];
}
function fixture(t,updates=appUpdates,tags=normalSignedTags()){
  const root=mkdtempSync(join(tmpdir(),'negresco-ota-native-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'certs'));
  writeFileSync(join(root,'certs','certificate.pem'),pem);
  const app=join(root,'app.json');
  const native=join(root,'AndroidManifest.xml');
  writeFileSync(app,JSON.stringify({expo:{updates}}));
  writeFileSync(native,manifest(tags));
  return {root,app,native};
}
function run(f){
  return spawnSync('python3',[verifier,f.app,f.native],{encoding:'utf8',timeout:20000});
}
function allow(f,mode){
  const result=run(f);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,new RegExp('PASS:.*'+mode));
}
function deny(f,expected){
  const result=run(f);
  assert.equal(result.status,1,result.stdout+'\n'+result.stderr);
  assert.match(result.stderr,expected);
}

test('native manifest matches signed OTA config and PEM after XML escaping',t=>{
  allow(fixture(t),'signed-ota');
});
test('embedded-only mode needs actual native updates.ENABLED=false',t=>{
  const f=fixture(t,{enabled:false},[tag('ENABLED','false')]);
  allow(f,'embedded-only');
});
test('embedded-only rejects default-true native updates',t=>{
  deny(fixture(t,{enabled:false},[]),/not explicitly disabled/);
});
test('embedded-only rejects leftover signing certificate metadata',t=>{
  deny(fixture(t,{enabled:false},[tag('ENABLED','false'),tag('CODE_SIGNING_CERTIFICATE',pem)]),
    /must not embed/);
});
test('signed policy rejects native updates.ENABLED=false',t=>{
  const tags=normalSignedTags();
  tags[0]=tag('ENABLED','false');
  deny(fixture(t,appUpdates,tags),/explicitly enabled/);
});
test('signed policy rejects missing metadata in native manifest',t=>{
  deny(fixture(t,appUpdates,normalSignedTags().slice(0,2)),/not both embedded/);
});
test('signed policy rejects certificate substitution',t=>{
  const tags=normalSignedTags();
  tags[1]=tag('CODE_SIGNING_CERTIFICATE','untrusted certificate');
  deny(fixture(t,appUpdates,tags),/embedded certificate differs/);
});
test('signed policy rejects keyid substitution',t=>{
  const tags=normalSignedTags();
  tags[2]=tag('CODE_SIGNING_METADATA',JSON.stringify({alg:'rsa-v1_5-sha256',keyid:'attacker'}));
  deny(fixture(t,appUpdates,tags),/signing algorithm\/keyid differs/);
});
test('signed policy rejects invalid native metadata JSON',t=>{
  const tags=normalSignedTags();
  tags[2]=tag('CODE_SIGNING_METADATA','invalid json');
  deny(fixture(t,appUpdates,tags),/not valid JSON/);
});
test('signed policy rejects duplicate metadata',t=>{
  deny(fixture(t,appUpdates,[...normalSignedTags(),tag('CODE_SIGNING_METADATA','{}')]),
    /duplicate application metadata/);
});
test('signed policy rejects misplaced nested certificate metadata',t=>{
  const tags=[tag('ENABLED','true'),
    '<activity android:name=".Untrusted">'+tag('CODE_SIGNING_CERTIFICATE',pem)
    +tag('CODE_SIGNING_METADATA',JSON.stringify(appUpdates.codeSigningMetadata))+'</activity>'];
  deny(fixture(t,appUpdates,tags),/not both embedded/);
});
test('signed policy rejects unexpected code signing entry',t=>{
  deny(fixture(t,appUpdates,[...normalSignedTags(),tag('CODE_SIGNING_BYPASS','true')]),
    /unexpected code signing metadata/);
});
test('signed policy rejects DOCTYPE/ENTITY declarations',t=>{
  const f=fixture(t);
  writeFileSync(f.native,'<!DOCTYPE manifest [<!ENTITY x "hack">]>'+manifest(normalSignedTags()));
  deny(f,/doctype\/entities/);
});
test('signed policy rejects symlinked certificate input',t=>{
  const f=fixture(t);
  const other=join(f.root,'real.pem');
  writeFileSync(other,pem);
  rmSync(join(f.root,'certs','certificate.pem'));
  symlinkSync(other,join(f.root,'certs','certificate.pem'));
  deny(f,/symlink in certificate path/);
});
test('Android workflow verifies generated OTA policy after source gate and before signing',()=>{
  const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
  const build=workflow.slice(workflow.indexOf('  build-test-apk:'),workflow.indexOf('  publish-test-prerelease:'));
  const source=build.indexOf('      - name: Require signed Expo OTA or embedded-only code for stable release');
  const native=build.indexOf('      - name: Verify generated Android OTA manifest before stable signing');
  const gradle=build.indexOf('      - name: Build standalone test APK');
  assert.ok(source>=0&&native>source&&gradle>native,'native gate must precede Gradle');
  assert.match(build,/verify_generated_ota_manifest\.py app\.json android\/app\/src\/main\/AndroidManifest\.xml/);
  assert.match(build,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && \(inputs\.publish_release \|\| inputs\.stable_signing\)/);
  assert.match(workflow,/tests\/android-generated-ota-manifest\.test\.mjs/);
  assert.match(workflow,/tooling\/android\/verify_generated_ota_manifest\.py/);
});

test('native manifest rejects a preview channel masquerading as stable release',t=>{
  const tags=normalSignedTags();
  tags[4]=tag('UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',JSON.stringify({'expo-channel-name':'preview'}));
  deny(fixture(t,appUpdates,tags),/request channel must be production/);
});
test('native manifest rejects a substituted OTA server URL',t=>{
  const tags=normalSignedTags();
  tags[3]=tag('EXPO_UPDATE_URL','https://u.expo.dev/other-project');
  deny(fixture(t,appUpdates,tags),/endpoint differs from pinned production URL/);
});
test('native manifest rejects source config still pointing to preview',t=>{
  deny(fixture(t,{...appUpdates,requestHeaders:{'expo-channel-name':'preview'}}),/source endpoint\/channel/);
});
