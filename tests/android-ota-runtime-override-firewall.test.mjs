import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const script=resolve('tooling/android/verify_no_ota_runtime_override.cjs');
const firewall=require(script);
const nativePath='modules/negresco-finance-security/android/src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt';

function fixture(t,changes={}){
  const root=mkdtempSync(join(tmpdir(),'negresco-ota-runtime-firewall-'));
  t.after(()=>rmSync(root,{force:true,recursive:true}));
  const files=['App.tsx',nativePath,...Array.from({length:8},(_,i)=>'guardiao/clean-'+i+'.ts')];
  for(const rel of files){
    const dest=join(root,rel);
    mkdirSync(dirname(dest),{recursive:true});
    writeFileSync(dest,changes[rel]??'export const safe = 1;\n');
  }
  return root;
}
function candidate(t,rel,source){
  const root=fixture(t);
  const file=join(root,rel);
  mkdirSync(dirname(file),{recursive:true});
  writeFileSync(file,source);
  return root;
}
function fails(root,pattern){
  const x=firewall.scanRoot(root);
  assert.ok(x.violations.length,x.files.join('\n'));
  assert.match(x.violations.join('\n'),pattern);
}
test('real application runtime sources currently have no known OTA override imports or calls',()=>{
  const result=firewall.scanRoot(resolve('apps/mobile'));
  assert.ok(result.files.includes('App.tsx'));
  assert.ok(result.files.includes(nativePath));
  assert.equal(result.violations.length,0,result.violations.join('\n'));
});
test('ban static and dynamic expo-updates JS imports in the application',t=>{
  for(const statement of [
    "import * as Updates from 'expo-updates';",
    "import {setExtraParamAsync} from 'expo-updates';",
    "const Update = require('expo-updates');",
    'const Update = await import("expo-updates");',
    "import {something} from 'expo-updates/build/Updates';",
    "import 'expo-updates';",
    "const Updates = require('expo' + '-updates');"
  ])fails(candidate(t,'guardiao/injected.ts',statement+'\n'),/JavaScript expo-updates module import/);
});
test('block native OTA module lookup and Kotlin update controller access',t=>{
  for(const statement of [
    'val any = expo.modules.updates.UpdatesController',
    'val something = UpdatesController.instance',
    'val config = UpdatesConfiguration(context)',
    'val x = EXUpdatesAppController.sharedInstance'
  ])fails(candidate(t,'modules/negresco-finance-security/android/src/main/java/com/negresco/finance/security/Adversary.kt',statement+'\n'),/native Expo Updates/);
});
test('block OTA URL, request headers and Expo extra param API overrides',t=>{
  for(const name of [
    'setUpdateURLAndRequestHeadersOverride',
    'setUpdateURLOverride','setRequestHeadersOverride',
    'setExtraParamAsync','setUpdateRequestHeaders'
  ])fails(candidate(t,'security/ota.ts','Updates.'+name+'("production")'),/OTA runtime URL\/header override API/);
});
test('block explicit dynamic update object override/configure calls',t=>{
  fails(candidate(t,'security/ota.ts','Updates?.configureUnsafe("production");'),/dynamic update metadata override/);
});
test('exclude Expo generated Android output and app config plugins, not production Kotlin',t=>{
  const root=fixture(t);
  const put=(rel,content)=>{
    const dest=join(root,rel);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,content);
  };
  put('android/app/src/main/java/Fake.java','UpdatesController...');
  put('plugins/withTest.js','require("expo-updates")');
  put('modules/negresco-finance-security/android/src/androidTest/java/Adversary.kt','expo.modules.updates');
  put('modules/negresco-finance-security/android/src/debug/java/Adversary.kt','setExtraParamAsync');
  const result=firewall.scanRoot(root);
  assert.equal(result.violations.length,0,result.violations.join('\n'));
  assert.ok(result.files.includes(nativePath));
});
test('block symlinks hiding runtime code, rather than silently following them',t=>{
  const root=fixture(t);
  symlinkSync(join(root,'App.tsx'),join(root,'linked.ts'));
  assert.throws(()=>firewall.scanRoot(root),/linked mobile source path/);
});
test('block absent app entrypoint, native module or insufficient audited source files',t=>{
  const root=fixture(t);
  rmSync(join(root,'App.tsx'));
  assert.throws(()=>firewall.scanRoot(root),/entrypoint or native release source missing/);
});
test('block symlinked audit root',t=>{
  const root=fixture(t);
  const parent=dirname(root),alias=join(parent,'negresco-ota-audit-alias-'+process.pid);
  symlinkSync(root,alias);
  t.after(()=>rmSync(alias,{force:true}));
  assert.throws(()=>firewall.scanRoot(alias),/mobile source root must be an ordinary directory/);
});
test('block oversized source file rather than silently skipping it',t=>{
  const root=fixture(t);
  writeFileSync(join(root,'App.tsx'),'x'.repeat(1024*1024+1));
  assert.throws(()=>firewall.scanRoot(root),/oversized\/nonregular mobile source/);
});
test('auditor CLI blocks violation and returns success only after clean scan',t=>{
  const root=fixture(t);
  let r=spawnSync('node',[script,root],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/PASS:/);
  writeFileSync(join(root,'App.tsx'),"require('expo-updates');\n");
  r=spawnSync('node',[script,root],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,1);
  assert.match(r.stderr,/BLOCK: App.tsx:1/);
});
test('APK workflow explicitly invokes the firewall before Expo prebuild',()=>{
  const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
  const verify=workflow.indexOf('      - name: Audit production app OTA runtime override boundary');
  const prebuild=workflow.indexOf('      - name: Generate native Android project');
  assert.ok(verify>0&&prebuild>verify);
  assert.match(workflow,/node \.\.\/\.\.\/tooling\/android\/verify_no_ota_runtime_override\.cjs \./);
  assert.match(workflow,/tests\/android-ota-runtime-override-firewall\.test\.mjs/);
  assert.match(workflow,/tooling\/android\/verify_no_ota_runtime_override\.cjs/);
});
