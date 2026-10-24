import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const here = createRequire(import.meta.url);
const app = JSON.parse(readFileSync(new URL('../apps/mobile/app.json', import.meta.url),'utf8'));
const script = readFileSync(new URL('../apps/mobile/plugins/withNegrescoNoDataExtraction.js',import.meta.url),'utf8');

function mockPlugin() {
  let calledAndroidManifest=0;
  let calledDangerous=0;
  const module={exports:{}};
  const mocked=(id)=>{
    if(id==='expo/config-plugins')return {
      withAndroidManifest(config,callback) {
        calledAndroidManifest++;
        return callback(config);
      },
      withDangerousMod(config,[platform,callback]) {
        calledDangerous++;
        assert.equal(platform,'android');
        return {...config,applyResources:callback};
      }
    };
    return here(id);
  };
  new Function('require','module','exports',script)(mocked,module,module.exports);
  const plugin=module.exports;
  plugin.count=()=>[calledAndroidManifest,calledDangerous];
  return plugin;
}
const DOMAINS=['root','file','database','sharedpref','external',
  'device_root','device_file','device_database','device_sharedpref'];
const legacy=join('app','src','main','res','xml','negresco_legacy_no_backup.xml');
const modern=join('app','src','main','res','xml','negresco_no_data_extraction.xml');
function makeConfig(){
  return {modResults:{manifest:{application:[{$:{'android:allowBackup':'true'}}]}}};
}
async function apply(t,existing){
  const dir=mkdtempSync(join(tmpdir(),'negresco-extraction-rules-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const plugin=mockPlugin();
  const config=plugin(makeConfig());
  const result=await config.applyResources({...config,modRequest:{platformProjectRoot:dir}});
  assert.equal(result.modResults.manifest.application[0].$['android:allowBackup'],'false');
  assert.equal(result.modResults.manifest.application[0].$['android:dataExtractionRules'],'@xml/negresco_no_data_extraction');
  assert.equal(result.modResults.manifest.application[0].$['android:fullBackupContent'],'@xml/negresco_legacy_no_backup');
  assert.deepEqual(plugin.count(),[1,1]);
  return {dir,config:result};
}
function assertAllExclusions(xml){
  const actual=[...xml.matchAll(/<exclude domain="([^"]+)" path="([^"]+)"\/>/g)];
  for(const {1:domain,2:path} of actual){
    assert.ok(DOMAINS.includes(domain),domain);
    assert.equal(path,'.');
  }
  return actual.map(x=>x[1]);
}

test('Expo must load the explicit backup exclusion config plugin',()=>{
  assert.ok(app.expo.plugins.includes('./plugins/withNegrescoNoDataExtraction'));
  assert.equal(app.expo.android.allowBackup,false);
  assert.equal(app.expo.android.package,'com.negresco.finance');
});
test('plugin writes both Android 12+ and legacy backup resource references',async t=>{
  const {dir}=await apply(t);
  const modernText=readFileSync(join(dir,modern),'utf8');
  const legacyText=readFileSync(join(dir,legacy),'utf8');
  assert.match(modernText,/<data-extraction-rules>/);
  assert.match(modernText,/<cloud-backup disableIfNoEncryptionCapabilities="true">/);
  assert.match(modernText,/<device-transfer>/);
  assert.match(legacyText,/<full-backup-content>/);
  assert.doesNotMatch(modernText+legacyText,/<include/);
  assert.deepEqual(assertAllExclusions(legacyText),DOMAINS);
  assert.deepEqual(assertAllExclusions(modernText),[...DOMAINS,...DOMAINS]);
  const [cloud,d2d]=modernText.split(/<\/?device-transfer>/);
  assert.deepEqual(assertAllExclusions(cloud),DOMAINS);
  assert.deepEqual(assertAllExclusions(d2d),DOMAINS);
});
test('plugin fails closed if another plugin removes or adds a second application',()=>{
  const fn=mockPlugin();
  for(const applications of [[],[{},{}],null]){
    assert.throws(()=>fn({modResults:{manifest:{application:applications}}}),/exactly one application/);
  }
});
test('idempotent Expo prebuild does not mutate matching resources',async t=>{
  const {dir,config}=await apply(t);
  await config.applyResources({...config,modRequest:{platformProjectRoot:dir}});
  assert.equal(readFileSync(join(dir,modern),'utf8'),config && mockPlugin().DATA_EXTRACTION_XML);
});
test('preexisting altered extraction policy cannot be silently overwritten',async t=>{
  const {dir,config}=await apply(t);
  writeFileSync(join(dir,modern),'<data-extraction-rules></data-extraction-rules>\n');
  await assert.rejects(()=>config.applyResources({...config,modRequest:{platformProjectRoot:dir}}),/BLOCK: backup policy resource/);
});
test('symlinked policy file is always rejected',async t=>{
  const {dir,config}=await apply(t);
  const file=join(dir,modern);
  const fs=here('node:fs');
  fs.unlinkSync(file);
  symlinkSync(join(dir,legacy),file);
  await assert.rejects(()=>config.applyResources({...config,modRequest:{platformProjectRoot:dir}}),/BLOCK: backup policy resource/);
});
