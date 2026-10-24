import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,symlinkSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../apps/mobile/plugins/withNegrescoNetworkPolicy.js',import.meta.url),'utf8');
const config=JSON.parse(readFileSync(new URL('../apps/mobile/app.json',import.meta.url),'utf8'));

function plugin(){
  const module={exports:{}};
  function mocked(name){
    if(name==='expo/config-plugins'){
      return {
        withAndroidManifest(cfg,callback){return callback(cfg);},
        withDangerousMod(cfg,[platform,callback]){
          assert.equal(platform,'android');
          return {...cfg,writePolicy:callback};
        }
      };
    }
    return require(name);
  }
  new Function('require','module','exports',source)(mocked,module,module.exports);
  return module.exports;
}
function app(){
  return {modResults:{manifest:{application:[{$:{}}]}}};
}
const file='app/src/main/res/xml/negresco_network_security.xml';

async function fixture(t,override=undefined){
  const dir=mkdtempSync(join(tmpdir(),'negresco-network-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const p=plugin();
  const value=p(override??app());
  assert.equal(value.modResults.manifest.application[0].$['android:usesCleartextTraffic'],'false');
  assert.equal(value.modResults.manifest.application[0].$['android:networkSecurityConfig'],'@xml/negresco_network_security');
  return {p,value,dir,path:join(dir,file)};
}
test('Expo config applies hardened network policy after backup policy',()=>{
  const plugins=config.expo.plugins;
  assert.ok(plugins.indexOf('./plugins/withNegrescoNetworkPolicy')>
            plugins.indexOf('./plugins/withNegrescoNoDataExtraction'));
  assert.equal(config.expo.android.allowBackup,false);
});
test('generated network XML disables cleartext and only trusts system CAs',async t=>{
  const {p,value,dir,path}=await fixture(t);
  await value.writePolicy({...value,modRequest:{platformProjectRoot:dir}});
  assert.equal(readFileSync(path,'utf8'),p.NETWORK_SECURITY_XML);
  assert.match(p.NETWORK_SECURITY_XML,/<base-config cleartextTrafficPermitted="false">/);
  assert.match(p.NETWORK_SECURITY_XML,/<certificates src="system"\/>/);
  assert.doesNotMatch(p.NETWORK_SECURITY_XML,/<domain-config|<debug-overrides|src="user"|cleartextTrafficPermitted="true"/);
  await value.writePolicy({...value,modRequest:{platformProjectRoot:dir}});
});
test('unexpected network policy reference cannot be overwritten',()=>{
  const cfg=app();cfg.modResults.manifest.application[0].$['android:networkSecurityConfig']='@xml/insecure';
  assert.throws(()=>plugin()(cfg),/competing Android network security configuration/);
});
test('missing or multiple application elements fails closed',()=>{
  for(const apps of [[],null,[{$:{}},{$:{}}],[{}]]) {
    assert.throws(()=>plugin()({modResults:{manifest:{application:apps}}}),/requires one application/);
  }
});
test('modified on-disk network XML must be rejected instead of overwritten',async t=>{
  const {value,dir,path}=await fixture(t);
  await value.writePolicy({...value,modRequest:{platformProjectRoot:dir}});
  writeFileSync(path,'<network-security-config><base-config cleartextTrafficPermitted="true"/></network-security-config>\n');
  await assert.rejects(()=>value.writePolicy({...value,modRequest:{platformProjectRoot:dir}}),/network policy changed or linked/);
});
test('network policy symlinks must be rejected',async t=>{
  const {value,dir,path}=await fixture(t);
  await value.writePolicy({...value,modRequest:{platformProjectRoot:dir}});
  unlinkSync(path);symlinkSync('/dev/null',path);
  await assert.rejects(()=>value.writePolicy({...value,modRequest:{platformProjectRoot:dir}}),/network policy changed or linked/);
});

const wf=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const pub=wf.slice(wf.indexOf('  publish-test-prerelease:'));
test('native build and privileged publisher independently pin cleartext policy',()=>{
  assert.match(wf,/net\.NETWORK_SECURITY_FILE,net\.NETWORK_SECURITY_XML/);
  assert.match(wf,/android:networkSecurityConfig="@xml\/negresco_network_security"/);
  assert.match(wf,/android:usesCleartextTraffic="false"/);
  assert.match(wf,/aapt" dump xmltree "\$APK" AndroidManifest\.xml/);
  assert.match(wf,/networkSecurityConfig","?\s*\]/);
  assert.match(pub,/policyResource\("networkSecurityConfig"\)/);
  assert.match(pub,/attribute\("usesCleartextTraffic", true\)/);
  assert.match(pub,/backup and network policies must use distinct resource IDs/);
  assert.match(wf,/tests\/android-cleartext-network-policy\.test\.mjs/);
});
