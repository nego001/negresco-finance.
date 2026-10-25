import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const source=readFileSync(resolve('apps/mobile/plugins/withNegrescoOtaRuntimeLock.js'),'utf8');
const py=resolve('tooling/android/verify_generated_ota_runtime.py');
const realApp=JSON.parse(readFileSync(resolve('apps/mobile/app.json'),'utf8'));
const VERSION='3.1.3';

function plugin(){
  const module={exports:{}};
  const mock=name=>name==='expo/config-plugins'?{
    withStringsXml(config,fn){return fn(config);}
  }:require(name);
  new Function('require','module','exports',source)(mock,module,module.exports);
  return module.exports;
}
function model(version=VERSION,strings=[]){
  return {version,runtimeVersion:{policy:'appVersion'},
    modResults:{resources:{string:structuredClone(strings)}}};
}
function fileFixture(t,opts={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-ota-runtime-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const res=join(dir,'res'),values=join(res,'values');
  mkdirSync(values,{recursive:true});
  const app=join(dir,'app.json'),manifest=join(dir,'AndroidManifest.xml');
  const strings=join(values,'strings.xml');
  const ver=opts.version??VERSION;
  writeFileSync(app,JSON.stringify({expo:{version:ver,runtimeVersion:opts.runtimeVersion??{policy:'appVersion'}}}));
  const metadata=opts.meta??'<meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>';
  writeFileSync(manifest,'<?xml version="1.0"?><manifest xmlns:android="http://schemas.android.com/apk/res/android"><application>'+metadata+'</application></manifest>');
  const xml=opts.xml??'<resources><string name="app_name">Negresco Finance</string><string name="expo_runtime_version" translatable="false">'+ver+'</string></resources>';
  writeFileSync(strings,xml);
  return {dir,res,values,app,manifest,strings};
}
function run(f){return spawnSync('python3',[py,f.app,f.manifest,f.strings,f.res],{encoding:'utf8',timeout:10000});}
function pass(f){const r=run(f);assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/non-translatable appVersion/);}
function fails(f,error){const r=run(f);assert.notEqual(r.status,0,r.stdout+r.stderr);assert.match(r.stderr,error);}

test('Expo runtime lock is registered after security plugins and appVersion policy is explicit',()=>{
  assert.equal(realApp.expo.version,VERSION);
  assert.deepEqual(realApp.expo.runtimeVersion,{policy:'appVersion'});
  const arr=realApp.expo.plugins;
  assert.ok(arr.indexOf('./plugins/withNegrescoOtaRuntimeLock')>arr.indexOf('./plugins/withNegrescoNetworkPolicy'));
});
test('plugin locks existing Expo resource and preserves unrelated strings',()=>{
  const previous=[{$:{name:'app_name'},_:'Negresco Finance'},
    {$:{name:'expo_runtime_version'},_:VERSION}];
  const locked=plugin()(model(VERSION,previous));
  assert.equal(locked.modResults.resources.string[0]._,'Negresco Finance');
  assert.deepEqual(locked.modResults.resources.string[1],
    {$:{name:'expo_runtime_version',translatable:'false'},_:VERSION});
});
test('plugin supplies locked runtime if Expo has not written it yet',()=>{
  const p=plugin(),x=p(model());
  assert.deepEqual(x.modResults.resources.string,
    [{$:{name:'expo_runtime_version',translatable:'false'},_:VERSION}]);
  assert.deepEqual(p.lockRuntimeStrings(x.modResults,VERSION),x.modResults);
});
test('plugin blocks duplicate names and altered runtime strings',()=>{
  const dup=Array(2).fill(null).map(()=>({$:{name:'expo_runtime_version'},_:VERSION}));
  assert.throws(()=>plugin()(model(VERSION,dup)),/duplicate Android OTA runtime resource/);
  for(const item of [
    {$:{name:'expo_runtime_version',translatable:'true'},_:VERSION},
    {$:{name:'expo_runtime_version'},_:'1.0.0'}
  ])assert.throws(()=>plugin()(model(VERSION,[item])),/competing OTA runtime|runtime differs from appVersion/);
});
test('plugin blocks unsupported runtime version policies',()=>{
  assert.throws(()=>plugin()({...model(),runtimeVersion:{policy:'sdkVersion'}}),/explicit appVersion/);
  assert.throws(()=>plugin()(model('first release')),/explicit appVersion/);
});
test('generated manifest and nontranslatable resource match appVersion',t=>pass(fileFixture(t)));
test('generated auditor rejects translated or missing translatable attribute',t=>{
  fails(fileFixture(t,{xml:'<resources><string name="expo_runtime_version" translatable="true">'+VERSION+'</string></resources>'}),/translatable=false/);
  fails(fileFixture(t,{xml:'<resources><string name="expo_runtime_version">'+VERSION+'</string></resources>'}),/translatable=false/);
});
test('generated auditor rejects different runtime version and duplicate default resources',t=>{
  fails(fileFixture(t,{xml:'<resources><string name="expo_runtime_version" translatable="false">1.0.0</string></resources>'}),/differs from pinned appVersion/);
  const entry='<string name="expo_runtime_version" translatable="false">'+VERSION+'</string>';
  fails(fileFixture(t,{xml:'<resources>'+entry+entry+'</resources>'}),/exactly once/);
});
test('generated auditor rejects localized Android runtime override',t=>{
  const f=fileFixture(t),dir=join(f.res,'values-pt');
  mkdirSync(dir);
  writeFileSync(join(dir,'strings.xml'),'<resources><string name="expo_runtime_version">9.9.9</string></resources>');
  fails(f,/duplicate\/translated runtime resource/);
});
test('generated auditor rejects locale qualifier item override',t=>{
  const f=fileFixture(t),dir=join(f.res,'values-es');
  mkdirSync(dir);
  writeFileSync(join(dir,'values.xml'),'<resources><item type="string" name="expo_runtime_version">9.9.9</item></resources>');
  fails(f,/duplicate\/translated runtime resource/);
});
test('generated auditor rejects manifest inline version or duplicate meta-data',t=>{
  fails(fileFixture(t,{meta:'<meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="1.0.0"/>'}),/must reference only/);
  const tag='<meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>';
  fails(fileFixture(t,{meta:tag+tag}),/must reference only/);
});
test('generated auditor rejects downgraded version policy and symlinked source',t=>{
  fails(fileFixture(t,{runtimeVersion:{policy:'sdkVersion'}}),/must use the appVersion policy/);
  const f=fileFixture(t),orig=join(f.dir,'original.xml');
  writeFileSync(orig,readFileSync(f.strings));
  rmSync(f.strings);symlinkSync(orig,f.strings);
  fails(f,/XML input is missing, linked/);
});
test('workflow checks runtime resource after prebuild and before Gradle',()=>{
  const wf=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
  const seg=wf.slice(wf.indexOf('  build-test-apk:'),wf.indexOf('  publish-test-prerelease:'));
  const prebuild=seg.indexOf('      - name: Generate native Android project');
  const audit=seg.indexOf('      - name: Verify non-translatable Expo OTA runtime resource');
  const gradle=seg.indexOf('      - name: Build standalone test APK');
  assert.ok(prebuild>0&&audit>prebuild&&gradle>audit);
  assert.match(seg,/verify_generated_ota_runtime\.py app\.json android\/app\/src\/main\/AndroidManifest\.xml android\/app\/src\/main\/res\/values\/strings\.xml android\/app\/src\/main\/res/);
  assert.match(wf,/tests\/android-ota-runtime-string-lock\.test\.mjs/);
  assert.match(wf,/tooling\/android\/verify_generated_ota_runtime\.py/);
});
