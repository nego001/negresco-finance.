import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const app=readFileSync('apps/mobile/App.tsx','utf8');
const debug=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const runner=readFileSync('tooling/android/guardiao_debug_window_root_frame_lab.py','utf8');
const wf=readFileSync('.github/workflows/guardiao-debug-window-root-frame-lab.yml','utf8');

test('Debug-only independent window-frame reference preserves Release role and styling',()=>{
 assert.match(app,/const labWindowRoot=useRef/);
 assert.match(app,/root\.measureInWindow\(\(rx,ry,rw,rh\)=>/);
 assert.match(app,/native\.measureInWindow\(\(x,y,width,height\)=>/);
 assert.match(app,/StatusBar\.currentHeight\?\?0/);
 assert.match(app,/regular-below-viewport/);
 assert.match(app,/'-rootframe-' \+ \(labWindowRootFrame\[/);
 assert.match(app,/'-edge-' \+ \(labWindowEdgeGap\[/);
 assert.match(app,/ref=\{__DEV__\?labWindowRoot:undefined\}/);
 assert.match(app,/accessibilityRole="tab"/);
 assert.match(app,/bottom:\{height:76,paddingHorizontal:12,paddingBottom:4,/);
 assert.match(debug,/def safe_debug_window_root_frame_category\(\) -> str:/);
});
test('root frame lab never touches or exports PDF, logs only categories',()=>{
 assert.match(wf,/lab\/p01-guardiao-debug-window-root-frame-v1/);
 assert.match(wf,/script: python3 tooling\/android\/guardiao_debug_window_root_frame_lab\.py/);
 assert.match(wf,/api-level: 28/);
 assert.match(wf,/assembleDebug/);
 assert.match(wf,/contents: read/);
 assert.match(wf,/persist-credentials: false/);
 assert.doesNotMatch(wf,/assembleRelease|workflow_dispatch|upload-artifact|contents: write|eas update|secrets\./);
 assert.match(runner,/debug\.debug_digest\(\)/);
 assert.match(runner,/Debug window versus root frame=/);
 assert.match(runner,/no tap approval/);
 assert.doesNotMatch(runner,/BASE\.adb\("shell", "input"|BASE\.tap_node|BASE\.scroll_forward|BASE\.scroll_backward|screencap|print\(raw\)|force-stop|pm", "clear"/);
});
test('strict native window and root frame parser rejects missing and malformed evidence',()=>{
 const src=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_pdf_debug_metro_lab as x',
 'names=["home","pix","negresco"]',
 'rects=["[0,800][310,900]","[320,800][650,900]","[660,800][1000,900]"]',
 'def nodes(frame="inside-root",edge="inset-sized"):',
 ' return [{"resource-id":"p:id/negresco-lab-tab-"+n+"-yoga-regular-bottom-regular-placement-inside-root-window-regular-below-viewport-rootframe-"+frame+"-edge-"+edge,"package":"p","bounds":b,"clickable":"true","enabled":"true"} for n,b in zip(names,rects)]',
 'x.base.screen_size=lambda:(1080,960)',
 'x.base.xml_nodes=lambda:nodes()',
 'assert x.safe_debug_window_measure_category()=="window-at-least-one-outside"',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-all-inside-window-inset-sized"',
 'assert x.safe_debug_testid_nav_geometry()=="testid-three-targets-bounded-readonly"',
 'x.base.xml_nodes=lambda:nodes(edge="beyond-inset")',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-all-inside-window-beyond-inset"',
 'x.base.xml_nodes=lambda:nodes(frame="below-root")',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-at-least-one-below"',
 'x.base.xml_nodes=lambda:nodes(edge="unconfirmed")',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-incomplete"',
 'x.base.xml_nodes=lambda:nodes()[:2]',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-targets-unconfirmed"',
 'x.base.xml_nodes=lambda:nodes()+[nodes()[0]]',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-targets-unconfirmed"',
 'x.base.xml_nodes=lambda:(_ for _ in ()).throw(RuntimeError("PRIVATE_XML"))',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-collection-unconfirmed"',
 'print("PASS: independent root/frame categories")'
 ].join('\n');
 const r=spawnSync('python3',['-c',src],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS: independent root\/frame categories/);
});
