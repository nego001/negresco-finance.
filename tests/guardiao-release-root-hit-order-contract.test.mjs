import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('apps/mobile/App.tsx','utf8');

test('Android root hit-order is applied to both Debug and isolated Release-mode candidate',()=>{
 const start=app.indexOf('return <SafeAreaView');
 const end=app.indexOf(' onLayout={__DEV__?',start);
 assert.ok(start>=0&&end>start,'SafeAreaView root expected');
 const root=app.slice(start,end);
 assert.match(root,/style=\{\[s\.root,/);
 assert.match(root,/Platform\.OS==='android'&&s\.labAndroidRootHitOrder/);
 assert.doesNotMatch(root,/__DEV__&&Platform\.OS==='android'&&s\.labAndroidRootHitOrder/);
 assert.match(root,/Platform\.OS==='android'&&\{paddingBottom:\(StatusBar\.currentHeight\?\?24\)\}/);
 assert.doesNotMatch(root,/__DEV__&&Platform\.OS==='android'&&\{paddingBottom/);
 assert.match(app,/labAndroidRootHitOrder:\{zIndex:4,elevation:4\}/);
 assert.equal((root.match(/s\.labAndroidRootHitOrder/g)||[]).length,1);
});
test('root hit-order experiment keeps navigation handlers, native bounds and PDF security unchanged',()=>{
 assert.match(app,/style=\{\[s\.bottom,s\.labBottomBounds\]\}/);
 assert.match(app,/style=\{\[s\.nav,s\.labNavBounds,page===x\.name&&s\.navSelected\]\}/);
 assert.match(app,/labBottomBounds:\{minHeight:76,flexShrink:0\}/);
 assert.match(app,/labNavBounds:\{height:60,minHeight:60,flexShrink:0\}/);
 assert.match(app,/onPress=\{\(\)=>nav\(x\.name as Page\)\}/);
 assert.match(app,/accessibilityRole="tab"/);
 assert.match(app,/accessibilityState=\{\{selected:page===x\.name\}\}/);
 assert.match(app,/const releasePdfGate=pdfNativeGate\.current\.acquire\(\)/);
 assert.match(app,/releasePdfGate\(\)/);
 assert.match(app,/reportPdfBusy&&reportPdfLongPending&&pdfNativeGate\.current\.busy\(\)/);
 assert.doesNotMatch(app,/Promise\.race\(\[Print\.printToFileAsync/);
});
