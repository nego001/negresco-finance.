import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,readlinkSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const source='tooling/android/sanitize_guardiao_debug_manifest.py';
const workflow=readFileSync('.github/workflows/guardiao-android-debug-metro-phase-lab.yml','utf8');
const ANDROID='http://schemas.android.com/apk/res/android';
const TOOLS='http://schemas.android.com/tools';
const DENIED=[
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES'
];
const original='<manifest xmlns:android="'+ANDROID+'" package="com.synthetic.lab">'+
  '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>'+
  '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>'+
  '<uses-permission android:name="android.permission.INTERNET"/>'+
  '<application android:debuggable="true"/></manifest>';
function temp(fn){
  const root=mkdtempSync(join(tmpdir(),'negresco-debug-policy-'));
  const dir=join(root,'debug');mkdirSync(dir);
  const manifest=join(dir,'AndroidManifest.xml');
  try{return fn({root,manifest});}finally{rmSync(root,{recursive:true,force:true});}
}
function run(file){return spawnSync('python3',[source,file],{encoding:'utf8',timeout:15000});}

test('Debug overlay removes forbidden declarations without removing ordinary network access',()=>temp(({manifest})=>{
  writeFileSync(manifest,original);
  let result=run(manifest);
  assert.equal(result.status,0,result.stderr);
  result=run(manifest);
  assert.equal(result.status,0,'permission patch must be idempotent');
  const after=readFileSync(manifest,'utf8');
  for(const p of DENIED){
    assert.equal(after.split(p).length-1,1,p);
    assert.match(after,/tools:node="remove"/);
  }
  assert.match(after,/android.permission.INTERNET/);
  assert.match(after,/android:debuggable="true"/);
  assert.doesNotMatch(result.stdout,/INTERNET|SYSTEM_ALERT_WINDOW|AndroidManifest.xml/);
}));

test('fail closed on invalid XML, missing file and symlink',()=>temp(({root,manifest})=>{
  assert.equal(run(manifest).status,1);
  writeFileSync(manifest,'<manifest><not-closed>');
  assert.equal(run(manifest).status,1);
  const outside=join(root,'elsewhere.xml');
  writeFileSync(outside,original);
  rmSync(manifest);symlinkSync(outside,manifest);
  assert.equal(run(manifest).status,1);
  assert.equal(run(outside).status,1);
}));

test('workflow patches only isolated Debug overlay, retains final assembled APK permission gate',()=>{
  assert.match(workflow,/python3 tooling\/android\/sanitize_guardiao_debug_manifest\.py apps\/mobile\/android\/app\/src\/debug\/AndroidManifest\.xml/);
  const patch=workflow.indexOf('name: Remove denied permissions from disposable Debug manifest overlay');
  const build=workflow.indexOf('name: Bound Gradle resources and assemble Android Debug, not Release');
  const check=workflow.indexOf('name: Validate unsigned-for-production debug APK, pin its SHA locally');
  assert.ok(patch>0 && patch<build && check>build);
  assert.match(workflow,/BLOCK \(LAB\): forbidden Android permission in debug-only APK/);
  assert.match(workflow,/apksigner" verify --verbose/);
  assert.doesNotMatch(workflow,/workflow_dispatch|contents: write|secrets\.|stable_signing|upload-artifact/);
  const implementation=readFileSync(source,'utf8');
  assert.match(implementation,/ET\.SubElement\(/);
  assert.match(implementation,/f"\{\{\{TOOLS\}\}\}node": "remove"/);
});
