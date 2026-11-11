import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const app=readFileSync('apps/mobile/App.tsx','utf8');
const runner=readFileSync('tooling/android/guardiao_debug_bottom_inset_offset_lab.py','utf8');
const wf=readFileSync('.github/workflows/guardiao-debug-bottom-inset-offset-lab.yml','utf8');

test('only Debug Android adds bottom-safe inset; original Release layout stays identical',()=>{
 assert.match(app,/style=\{\[s\.root,\{paddingTop:Platform\.OS==='android'\?\(StatusBar\.currentHeight\?\?24\):0\},__DEV__&&Platform\.OS==='android'&&\{paddingBottom:\(StatusBar\.currentHeight\?\?24\)\}\]\}/);
 assert.match(app,/accessibilityRole="tab"/);
 assert.match(app,/onPress=\{\(\)=>nav\(x\.name as Page\)\}/);
 assert.match(app,/bottom:\{height:76,paddingHorizontal:12,paddingBottom:4,/);
 assert.match(app,/labBottomBounds:\{minHeight:76,flexShrink:0\}/);
 assert.match(app,/labNavBounds:\{height:60,minHeight:60,flexShrink:0\}/);
 assert.match(app,/root:\{flex:1,backgroundColor:C\.bg\}/);
});
test('A/B captures both success and failure, never interprets size as navigation approval',()=>{
 assert.match(wf,/lab\/p01-guardiao-debug-bottom-inset-offset-v1/);
 assert.match(wf,/script: python3 tooling\/android\/guardiao_debug_bottom_inset_offset_lab\.py/);
 assert.match(wf,/assembleDebug/);
 assert.match(wf,/api-level: 28/);
 assert.match(wf,/contents: read/);
 assert.match(wf,/persist-credentials: false/);
 assert.doesNotMatch(wf,/assembleRelease|workflow_dispatch|upload-artifact|eas update|secrets\./);
 assert.match(runner,/Debug bottom-inset native target bounds=/);
 assert.match(runner,/testid-three-targets-thin/);
 assert.match(runner,/testid-three-targets-bounded-readonly/);
 assert.match(runner,/not-applicable-target-bounded/);
 assert.match(runner,/stable thin ancestor evidence unconfirmed/);
 assert.match(runner,/bounded native target window proof rejected/);
 assert.match(runner,/NO navigation or tap approval/);
 assert.doesNotMatch(runner,/BASE\.adb\("shell", "input"|BASE\.tap_node|BASE\.scroll_forward|BASE\.scroll_backward|screencap|print\(raw\)|force-stop|pm", "clear"/);
});
test('categorical parser still rejects incomplete or malformed native evidence',()=>{
 const script=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_pdf_debug_metro_lab as x',
 'names=["home","pix","negresco"]',
 'rects=["[0,800][310,900]","[320,800][650,900]","[660,800][1000,900]"]',
 'def nodes(frame="inside-root",edge="not-below"):',
 ' return [{"resource-id":"p:id/negresco-lab-tab-"+n+"-yoga-regular-bottom-regular-placement-inside-root-window-regular-in-viewport-rootframe-"+frame+"-edge-"+edge,"package":"p","bounds":b,"clickable":"true","enabled":"true"} for n,b in zip(names,rects)]',
 'x.base.screen_size=lambda:(1080,960)',
 'x.base.xml_nodes=lambda:nodes()',
 'assert x.safe_debug_window_measure_category()=="window-three-regular-in-viewport"',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-all-inside-window-not-below"',
 'assert x.safe_debug_testid_nav_geometry()=="testid-three-targets-bounded-readonly"',
 'x.base.xml_nodes=lambda:nodes(frame="below-root")',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-at-least-one-below"',
 'x.base.xml_nodes=lambda:nodes()[:2]',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-targets-unconfirmed"',
 'x.base.xml_nodes=lambda:(_ for _ in ()).throw(RuntimeError("PRIVATE_XML"))',
 'assert x.safe_debug_window_root_frame_category()=="rootframe-collection-unconfirmed"',
 'print("PASS: strict inset A/B classifications")'
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS: strict inset A\/B classifications/);
});

test('bounded targets bypass obsolete thin ancestry, but only when window/root are safe',()=>{
 const script=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_bottom_inset_offset_lab as lab',
 'good="testid-three-targets-bounded-readonly"',
 'thin="testid-three-targets-thin"',
 'visible="window-three-regular-in-viewport"',
 'root="rootframe-all-inside-window-not-below"',
 'assert lab.bounded_native_window_proof(good,visible,root)',
 'assert lab.bounded_native_window_proof(good,visible,"rootframe-all-inside-window-inset-sized")',
 'for invalid in (thin,"testid-targets-mixed-or-unsafe","testid-nodes-unconfirmed"):',
 ' assert not lab.bounded_native_window_proof(invalid,visible,root)',
 'for invalid in ("window-at-least-one-outside","window-at-least-one-thin","window-category-unconfirmed"):',
 ' assert not lab.bounded_native_window_proof(good,invalid,root)',
 'for invalid in ("rootframe-at-least-one-below","rootframe-at-least-one-above","rootframe-at-least-one-side","rootframe-incomplete"):',
 ' assert not lab.bounded_native_window_proof(good,visible,invalid)',
 'print("PASS: bounded native proof is strict and has no gesture")'
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS: bounded native proof is strict and has no gesture/);
});
