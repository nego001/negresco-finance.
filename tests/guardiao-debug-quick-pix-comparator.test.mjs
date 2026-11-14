import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const runner=readFileSync('tooling/android/guardiao_debug_touch_delivery_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-quick-pix-comparator.yml','utf8');
const primary=readFileSync('.github/workflows/guardiao-debug-touch-delivery-lab.yml','utf8');
const app=readFileSync('apps/mobile/App.tsx','utf8');

test('isolated Android API28 comparator cannot become Release or change original workflow',()=>{
 assert.match(workflow,/guardiao-debug-quick-pix-comparator\.yml/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/--quick-pix-comparator/);
 assert.match(workflow,/permissions:\n  contents: read/);
 assert.match(workflow,/guardiao-debug-quick-pix-\$\{\{ github\.ref \}\}/);
 assert.doesNotMatch(workflow,/assembleRelease|eas build|upload-artifact|payments/);
 assert.match(primary,/script: python3 tooling\/android\/guardiao_debug_touch_delivery_lab\.py\n/);
 assert.doesNotMatch(primary,/--quick-pix-comparator/);
});
test('quick Pix comparison is a single fail-closed demo shortcut gesture',()=>{
 assert.match(app,/accessibilityLabel=\{'Abrir '\+x\.name\}/);
 assert.match(runner,/def safe_quick_pix_point\(/);
 assert.match(runner,/def quick_pix_comparator\(/);
 assert.match(runner,/n\.get\("content-desc"\)=="Abrir Pix"/);
 assert.match(runner,/len\(matches\)!=1/);
 assert.match(runner,/y2<int\(height\*\.78\)/);
 assert.match(runner,/first is None or first!=second/);
 assert.match(runner,/mode==\("--quick-pix-comparator",\)/);
 assert.match(runner,/native=="native-page-pix-pressin-no-call-yes"/);
 assert.match(runner,/category!="quick-pix-nav-confirmed"/);
 assert.match(runner,/MAX_GESTURES = 2/);
 const quick=runner.split('def quick_pix_comparator() -> None:')[1].split('\n\ndef run() -> None:')[0];
 assert.equal((quick.match(/"input","tap"/g)||[]).length,1);
 assert.doesNotMatch(quick,/swipe|exportLocalPdf|performClick|reportPdf/);
});
