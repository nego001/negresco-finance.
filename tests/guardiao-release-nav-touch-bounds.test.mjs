import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('apps/mobile/App.tsx','utf8');

test('Android release preview and Debug both reserve bounded bottom tabs without shortcut navigation',()=>{
 // These exact safe bounds previously existed only behind __DEV__.
 assert.match(source,/style=\{\[s\.bottom,s\.labBottomBounds\]\}/);
 assert.match(source,/style=\{\[s\.nav,s\.labNavBounds,page===x\.name&&s\.navSelected\]\}/);
 assert.doesNotMatch(source,/__DEV__&&s\.labBottomBounds|__DEV__&&s\.labNavBounds/);
 assert.match(source,/labBottomBounds:\{minHeight:76,flexShrink:0\}/);
 assert.match(source,/labNavBounds:\{height:60,minHeight:60,flexShrink:0\}/);
 assert.match(source,/accessibilityRole="tab"/);
 assert.match(source,/accessibilityState=\{\{selected:page===x\.name\}\}/);
 assert.match(source,/onPress=\{\(\)=>nav\(x\.name as Page\)\}/);
 assert.match(source,/key=\{x\.name\}/);
});
test('Release bottom target layout fix does not disable protected app or add auto-taps',()=>{
 assert.match(source,/const \[reportPdfBusy,setReportPdfBusy\]=useState\(false\)/);
 assert.match(source,/reportPdfBusy&&reportPdfLongPending&&pdfNativeGate\.current\.busy\(\)/);
 assert.match(source,/const releasePdfGate=pdfNativeGate\.current\.acquire\(\)/);
 assert.match(source,/releasePdfGate\(\)/);
 assert.doesNotMatch(source,/onPress=\{\(\)=>nav\('Início'\)\}\s*\/>/);
 // Root's Android bottom inset and debug-only observability stay unchanged
 // in this single native layout experiment, no 2nd copy of the nav bar.
 assert.match(source,/__DEV__&&Platform\.OS==='android'&&\{paddingBottom:\(StatusBar\.currentHeight\?\?24\)\}/);
 assert.equal((source.match(/style=\{\[s\.bottom,s\.labBottomBounds\]\}/g)||[]).length,1);
});
