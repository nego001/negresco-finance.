import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync('apps/mobile/App.tsx','utf8');
test('Android root bottom inset and hit order extend to test Release but stay Android-only',()=>{
 const root=app.split('return <SafeAreaView')[1]?.split(' onLayout={__DEV__')[0];
 assert.ok(root);
 assert.match(root,/Platform\.OS==='android'&&\{paddingBottom:\(StatusBar\.currentHeight\?\?24\)\}/);
 assert.match(root,/Platform\.OS==='android'&&s\.labAndroidRootHitOrder/);
 assert.doesNotMatch(root,/__DEV__&&Platform\.OS==='android'&&\{paddingBottom/);
 assert.doesNotMatch(root,/__DEV__&&Platform\.OS==='android'&&s\.labAndroidRootHitOrder/);
 assert.match(root,/paddingTop:Platform\.OS==='android'\?\(StatusBar\.currentHeight\?\?24\):0/);
 assert.equal((root.match(/paddingBottom/g)||[]).length,1);
 assert.equal((root.match(/labAndroidRootHitOrder/g)||[]).length,1);
});
test('experimental bottom inset retains exact touch minimum, accessible tabs and native PDF gate',()=>{
 assert.match(app,/labAndroidRootHitOrder:\{zIndex:4,elevation:4\}/);
 assert.match(app,/labBottomBounds:\{minHeight:76,flexShrink:0\}/);
 assert.match(app,/labNavBounds:\{height:60,minHeight:60,flexShrink:0\}/);
 assert.match(app,/style=\{\[s\.bottom,s\.labBottomBounds\]\}/);
 assert.match(app,/style=\{\[s\.nav,s\.labNavBounds,page===x\.name&&s\.navSelected\]\}/);
 assert.match(app,/accessibilityRole="tab"/);
 assert.match(app,/onPress=\{\(\)=>nav\(x\.name as Page\)\}/);
 assert.match(app,/const releasePdfGate=pdfNativeGate\.current\.acquire\(\)/);
 assert.match(app,/releasePdfGate\(\)/);
 assert.match(app,/reportPdfBusy&&reportPdfLongPending&&pdfNativeGate\.current\.busy\(\)/);
 assert.doesNotMatch(app,/Promise\.race\(\[Print\.printToFileAsync/);
});
