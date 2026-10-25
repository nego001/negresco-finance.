import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const {verify}=require('../tooling/android/verify_ota_release_signing.cjs');
const defaultUpdate={
  enabled:true,url:'https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95',
  codeSigningCertificate:'./certs/certificate.pem',
  codeSigningMetadata:{alg:'rsa-v1_5-sha256',keyid:'main'}
};
const config=JSON.parse(readFileSync(new URL('../apps/mobile/app.json',import.meta.url),'utf8'));
function fixture(t,updates=defaultUpdate){
  const folder=mkdtempSync(join(tmpdir(),'negresco-ota-release-'));
  t.after(()=>rmSync(folder,{force:true,recursive:true}));
  mkdirSync(join(folder,'certs'));
  const file=join(folder,'app.json');
  writeFileSync(file,JSON.stringify({expo:{updates}}));
  return {folder,file,cert:join(folder,'certs','certificate.pem')};
}
function cert(t,dir,days=365){
  const key=join(dir,'temporary-private-test-key.pem');
  const out=join(dir,'certs','certificate.pem');
  const args=['req','-x509','-newkey','rsa:2048','-noenc',
    '-keyout',key,'-out',out,'-days',String(days),'-subj','/CN=Negresco Test Fixture'];
  const result=spawnSync('openssl',args,{encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stderr);
  return out;
}
function denied(t,updates,expected,modify){
  const f=fixture(t,updates);
  if(modify)modify(f);
  assert.throws(()=>verify(f.file),expected);
}
test('current preview OTA config is unsigned, and stable release is blocked',()=>{
  assert.equal(config.expo.updates.enabled,true);
  assert.equal(config.expo.updates.codeSigningCertificate,undefined);
  assert.equal(config.expo.updates.codeSigningMetadata,undefined);
  assert.throws(()=>verify(new URL('../apps/mobile/app.json',import.meta.url).pathname),
    /enabled OTA must declare codeSigningCertificate/);
});
test('embedded-only build may be released without OTA signing key',t=>{
  const f=fixture(t,{enabled:false,url:defaultUpdate.url});
  assert.equal(verify(f.file).mode,'embedded-only');
});
test('valid public signing certificate and pinned metadata permit stable release',t=>{
  const f=fixture(t);
  cert(t,f.folder);
  const result=verify(f.file);
  assert.equal(result.mode,'signed-ota');
  assert.equal(result.keyid,'main');
  assert.match(result.certificateFingerprint,/^[0-9A-F:]+$/);
});
test('offline mode must reject contradictory OTA signing fields',t=>
  denied(t,{enabled:false,codeSigningCertificate:'./certs/certificate.pem'},
    /contradictory code-signing settings/));
for(const [label,updates,expected] of [
  ['missing explicit OTA configuration',undefined,/must be explicit/],
  ['updates.enabled missing',{url:defaultUpdate.url},/must explicitly be true or false/],
  ['updates.enabled malformed',{...defaultUpdate,enabled:'false'},/must explicitly be true or false/],
  ['non HTTPS update URL',{...defaultUpdate,url:'http://u.expo.dev/a'},/trusted HTTPS endpoint/],
  ['certificate path missing',{...defaultUpdate,codeSigningCertificate:undefined},/codeSigningCertificate/],
  ['certificate empty path',{...defaultUpdate,codeSigningCertificate:''},/codeSigningCertificate/],
  ['missing signature metadata',{...defaultUpdate,codeSigningMetadata:undefined},/signature metadata/],
  ['wrong update algorithm',{...defaultUpdate,codeSigningMetadata:{alg:'none',keyid:'main'}},/signature metadata/],
  ['empty keyid',{...defaultUpdate,codeSigningMetadata:{alg:'rsa-v1_5-sha256',keyid:''}},/signature metadata/],
  ['extra metadata field',{...defaultUpdate,codeSigningMetadata:{alg:'rsa-v1_5-sha256',keyid:'main',acceptUnsigned:true}},/signature metadata/],
  ['absolute certificate path',{...defaultUpdate,codeSigningCertificate:'/tmp/bad.pem'},/must be relative/],
  ['escaping certificate path',{...defaultUpdate,codeSigningCertificate:'../../outside.pem'},/escapes the app project/]
]){
  test('stable OTA signing gate blocks '+label,t=>{
    const f=fixture(t,updates);
    assert.throws(()=>verify(f.file),expected);
  });
}
test('missing certificate fails closed',t=>{
  const f=fixture(t);
  assert.throws(()=>verify(f.file),/missing or symlinked/);
});
test('symlinked certificate fails closed',t=>{
  const f=fixture(t);
  writeFileSync(join(f.folder,'other.pem'),'X');
  symlinkSync(join(f.folder,'other.pem'),f.cert);
  assert.throws(()=>verify(f.file),/missing or symlinked/);
});
test('fake PEM and private signing keys are never accepted as public certificate',t=>{
  const f=fixture(t);
  writeFileSync(f.cert,'-----BEGIN PRIVATE KEY-----\naaaa\n-----END PRIVATE KEY-----\n');
  assert.throws(()=>verify(f.file),/one PEM public certificate/);
  writeFileSync(f.cert,'-----BEGIN CERTIFICATE-----\naaaa\n-----END CERTIFICATE-----\n');
  assert.throws(()=>verify(f.file),/invalid X.509/);
});
test('certificate nearing expiry blocks stable publication',t=>{
  const f=fixture(t);
  cert(t,f.folder,1);
  assert.throws(()=>verify(f.file),/not valid for at least 30 more days/);
});
test('published release workflow runs signature gate before any stable signing or upload',()=>{
  const yml=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
  const build=yml.slice(yml.indexOf('  build-test-apk:'),yml.indexOf('  publish-test-prerelease:'));
  const check=build.indexOf('      - name: Require signed Expo OTA or embedded-only code for stable release');
  const signer=build.indexOf('      - name: Build standalone test APK');
  assert.ok(check>=0&&signer>check);
  assert.match(build,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && \(inputs\.publish_release \|\| inputs\.stable_signing\)/);
  assert.match(build,/node \.\.\/\.\.\/tooling\/android\/verify_ota_release_signing\.cjs app\.json/);
  assert.match(yml,/tests\/android-ota-release-signing\.test\.mjs/);
  assert.match(yml,/tooling\/android\/verify_ota_release_signing\.cjs/);
  const privileged=yml.slice(yml.indexOf('  publish-test-prerelease:'));
  assert.match(privileged,/inputs\.stable_signing/);
  assert.doesNotMatch(privileged,/actions\/checkout/);
});
