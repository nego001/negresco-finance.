import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {overrides} from '../tooling/android/guardiao_moderate_overrides_m134.mjs';
const dir='tooling/android/fixtures/m139-historical-baseline';
const app=readFileSync(dir+'/App.tsx');
const manifest=readFileSync(dir+'/package.json');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
test('M139 historical app and manifest exact original Git blobs',()=>{
 assert.equal(app.length,68538);assert.equal(blob(app),'9e706f4714f3a913823a02678c5c0e3dc89ecfdd');
 assert.equal(manifest.length,755);assert.equal(blob(manifest),'ecdd653eabeadeee8719b329fa725d89fb33842e');
});
test('M139 independently reconstructs candidate from immutable historical files',()=>{
 const temp=mkdtempSync(join(tmpdir(),'negresco-m139-'));
 try{
  mkdirSync(join(temp,'apps/mobile'),{recursive:true});
  writeFileSync(join(temp,'apps/mobile/App.tsx'),app);
  writeFileSync(join(temp,'apps/mobile/package.json'),manifest);
  execFileSync('git',['apply','--check',resolve('tooling/android/fixtures/guardiao-safe-insets-keyboard-candidate-m117.patch')],{cwd:temp});
  execFileSync('git',['apply',resolve('tooling/android/fixtures/guardiao-safe-insets-keyboard-candidate-m117.patch')],{cwd:temp});
  const next=readFileSync(join(temp,'apps/mobile/App.tsx'),'utf8');
  const p=JSON.parse(readFileSync(join(temp,'apps/mobile/package.json'),'utf8'));
  assert.equal(p.dependencies['react-native-safe-area-context'],'5.6.0');
  p.overrides=overrides;
  assert.equal(createHash('sha256').update(JSON.stringify(p,null,2)+'\n').digest('hex'),'61bf3916e30b74d248040f236fcb1e9a36e484aadb2331a461509c206849becd');
  assert.ok(next.includes('SafeAreaProvider initialMetrics={initialWindowMetrics}'));
  assert.ok(next.includes('paddingTop:insets.top,paddingBottom:insets.bottom,paddingLeft:insets.left,paddingRight:insets.right'));
  assert.ok(next.includes("keyboardShouldPersistTaps={page==='Guardião'?'handled':'never'}"));
  assert.ok(next.includes('accessibilityRole="tab"'));
  assert.ok(next.includes('const releasePdfGate=pdfNativeGate.current.acquire()'));
  assert.ok(!next.includes('return <SafeAreaView'));
 }finally{rmSync(temp,{recursive:true,force:true})}
});
