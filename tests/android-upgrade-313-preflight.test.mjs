import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('read-only Android preflight rejects unexpected APK before querying adb',()=>{
 const script=read('tooling/windows/compare-installed-apk.ps1');
 const pins=['ExpectedSha256','ExpectedCertSha256','ExpectedVersionName','ExpectedVersionCode'];
 for(const pin of pins){
  assert.match(script,new RegExp('PSBoundParameters\\.ContainsKey\\(\\x27'+pin+'\\x27\\)'));
  assert.match(script,new RegExp('\\$'+pin));
 }
 const firstAdbQuery=script.indexOf('$devices=@(& $adb devices)');
 assert.ok(firstAdbQuery>0);
 for(const field of ['ExpectedSha256','ExpectedCertSha256','ExpectedVersionName','ExpectedVersionCode']){
  const index=script.indexOf("PSBoundParameters.ContainsKey('"+field+"')");
  assert.ok(index>0 && index<firstAdbQuery, field+' must fail before device inspection');
 }
 assert.match(script,/Apk-Certificate \$signer \$apk/);
 assert.match(script,/Get-FileHash -LiteralPath \$apk -Algorithm SHA256/);
});

test('preflight remains non-destructive to installed app and its data',()=>{
 const script=read('tooling/windows/compare-installed-apk.ps1');
 assert.match(script,/adb -s \$serial pull/);
 assert.match(script,/SHA256 do certificado instalado/);
 assert.match(script,/Certificados diferentes/);
 assert.match(script,/VersionCode -le \$installed.VersionCode/);
 assert.doesNotMatch(script,/\badb\s+(?:-s\s+\$serial\s+)?(?:install|uninstall|root|remount|reboot|push)\b/i);
 assert.doesNotMatch(script,/\bpm\s+(?:clear|uninstall)\b/i);
 assert.doesNotMatch(script,/\brm\s+-rf\b/i);
});

test('3.1.3 test candidate has version code 34 and is not a stable release',()=>{
 const app=JSON.parse(read('apps/mobile/app.json')).expo;
 const workflow=read('.github/workflows/android-apk.yml');
 assert.equal(app.version,'3.1.3');
 assert.equal(app.android.versionCode,34);
 assert.match(workflow,/Negresco-Finance-V3\.1\.3-preview\.apk/);
 assert.match(workflow,/event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release/);
});
