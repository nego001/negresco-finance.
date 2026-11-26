import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {historicalAppPath} from './guardiao_historical_app_m144.mjs';
import {originalManifest,verifyActiveDependencyState} from './guardiao_dependency_state_m143.mjs';
export function reconstructLayout(){
 const root=mkdtempSync(join(tmpdir(),'negresco-m146-'));
 try{
  const mobile=join(root,'apps/mobile');
  mkdirSync(mobile,{recursive:true});
  originalManifest();
  writeFileSync(join(mobile,'App.tsx'),readFileSync(historicalAppPath()));
  writeFileSync(join(mobile,'package.json'),readFileSync('tooling/android/fixtures/m139-historical-baseline/package.json'));
  const patch=resolve('tooling/android/fixtures/guardiao-safe-insets-keyboard-candidate-m117.patch');
  execFileSync('git',['apply','--check',patch],{cwd:root});
  execFileSync('git',['apply',patch],{cwd:root});
  return readFileSync(join(mobile,'App.tsx'),'utf8');
 }finally{rmSync(root,{recursive:true,force:true})}
}
export function validateLayout(source,state){
 const old=readFileSync(historicalAppPath(),'utf8');
 if(state==='historical'){assert.equal(source,old);return state}
 assert.equal(state,'reviewed-lab-candidate');
 assert.equal(source,reconstructLayout());
 const root=source.split('return <View ref={__DEV__?labWindowRoot:undefined}')[1]?.split(' onLayout={__DEV__')[0];
 assert.ok(root);
 assert.ok(root.includes('paddingTop:insets.top,paddingBottom:insets.bottom,paddingLeft:insets.left,paddingRight:insets.right'));
 assert.ok(root.includes("Platform.OS==='android'&&s.labAndroidRootHitOrder"));
 assert.ok(source.includes('SafeAreaProvider initialMetrics={initialWindowMetrics}'));
 assert.ok(source.includes('const bottomInset=insets.bottom;'));
 assert.ok(source.includes('labAndroidRootHitOrder:{zIndex:1}'));
 assert.ok(source.includes('bottom:{height:76,paddingHorizontal:12,paddingBottom:4,'));
 assert.ok(source.includes("style={[s.nav,page===x.name&&s.navSelected]}"));
 assert.equal(source.split('style={s.bottom}').length,2);
 assert.equal(source.split("style={[s.nav,page===x.name&&s.navSelected]}").length,2);
 assert.ok(!source.includes('style={[s.bottom,s.labBottomBounds]}'));
 assert.ok(!source.includes('style={[s.nav,s.labNavBounds,page===x.name&&s.navSelected]}'));
 assert.ok(source.includes('accessibilityRole="tab"'));
 assert.ok(source.includes('accessibilityState={{selected:page===x.name}}'));
 assert.ok(source.includes('onPress={()=>nav(x.name as Page)}'));
 assert.ok(source.includes('const releasePdfGate=pdfNativeGate.current.acquire()'));
 assert.ok(source.includes('releasePdfGate()'));
 assert.ok(source.includes('reportPdfBusy&&reportPdfLongPending&&pdfNativeGate.current.busy()'));
 assert.ok(source.includes("keyboardShouldPersistTaps={page==='Guardião'?'handled':'never'}"));
 assert.doesNotMatch(source,/Promise\.race\(\[Print\.printToFileAsync/);
 assert.doesNotMatch(source,/StatusBar\.currentHeight|LogBox\.ignore/);
 return state;
}
export function verifyActiveLayout(){return validateLayout(readFileSync('apps/mobile/App.tsx','utf8'),verifyActiveDependencyState())}
