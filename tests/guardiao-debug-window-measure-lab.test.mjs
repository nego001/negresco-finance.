import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const app=readFileSync('apps/mobile/App.tsx','utf8');
const source=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const runner=readFileSync('tooling/android/guardiao_debug_window_measure_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-window-measure-lab.yml','utf8');

test('native measureInWindow in Debug records only bounded categories, preserving Release controls',()=>{
 assert.match(app,/const labWindowRefs=useRef/);
 assert.match(app,/native\.measureInWindow\(\(x,y,width,height\)=>/);
 assert.match(app,/Dimensions\.get\('window'\)\.height/);
 assert.match(app,/regular-in-viewport/);
 assert.match(app,/regular-below-viewport/);
 assert.match(app,/regular-above-viewport/);
 assert.match(app,/'-window-' \+ \(labWindowMeasured\[/);
 assert.match(app,/ref=\{__DEV__ \? node=>/);
 assert.match(app,/onLayout=\{__DEV__\?e=>\{const key=/);
 assert.match(app,/accessibilityRole="tab"/);
 assert.match(app,/bottom:\{height:76,paddingHorizontal:12,paddingBottom:4,/);
 assert.match(source,/def safe_debug_window_measure_category\(\) -> str:/);
});
test('window diagnostic cannot touch, publish, release, export PDF or bypass safeguards',()=>{
 assert.match(workflow,/lab\/p01-guardiao-debug-window-measure-v1/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_debug_window_measure_lab.py/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|upload-artifact|contents: write|eas update|secrets\./);
 assert.match(runner,/debug\.debug_digest\(\)/);
 assert.match(runner,/Debug native measureInWindow category=/);
 assert.match(runner,/no tap approval/);
 assert.doesNotMatch(runner,/BASE\.adb\("shell", "input"|BASE\.tap_node|BASE\.scroll_forward|BASE\.scroll_backward|screencap|print\(raw\)|force-stop|pm", "clear"/);
});
test('strict window category parser rejects partial or malformed tree',()=>{
 const script=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_pdf_debug_metro_lab as x',
 'names=["home","pix","negresco"]',
 'rects=["[0,800][310,900]","[320,800][650,900]","[660,800][1000,900]"]',
 'def nodes(status="regular-in-viewport"):',
 ' return [{"resource-id":"p:id/negresco-lab-tab-"+n+"-yoga-regular-bottom-regular-placement-inside-root-window-"+status,"package":"p","bounds":b,"clickable":"true","enabled":"true"} for n,b in zip(names,rects)]',
 'x.base.screen_size=lambda:(1080,960)',
 'x.base.xml_nodes=lambda:nodes()',
 'assert x.safe_debug_window_measure_category()=="window-three-regular-in-viewport"',
 'assert x.safe_debug_testid_yoga_category()=="testid-yoga-all-regular"',
 'assert x.safe_debug_bottom_placement_category()=="testid-bottom-inside-root"',
 'assert x.safe_debug_testid_nav_geometry()=="testid-three-targets-bounded-readonly"',
 'x.base.xml_nodes=lambda:nodes("thin")',
 'assert x.safe_debug_window_measure_category()=="window-at-least-one-thin"',
 'x.base.xml_nodes=lambda:nodes("regular-below-viewport")',
 'assert x.safe_debug_window_measure_category()=="window-at-least-one-outside"',
 'x.base.xml_nodes=lambda:nodes("unconfirmed")',
 'assert x.safe_debug_window_measure_category()=="window-category-unconfirmed"',
 'x.base.xml_nodes=lambda:nodes()[:2]',
 'assert x.safe_debug_window_measure_category()=="window-targets-unconfirmed"',
 'x.base.xml_nodes=lambda:nodes()+[nodes()[0]]',
 'assert x.safe_debug_window_measure_category()=="window-targets-unconfirmed"',
 'x.base.xml_nodes=lambda:(_ for _ in ()).throw(RuntimeError("SENSITIVE_XML"))',
 'assert x.safe_debug_window_measure_category()=="window-collection-unconfirmed"',
 'print("PASS: native measureInWindow strict categories")'
 ].join('\n');
 const result=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: native measureInWindow strict categories/);
});
