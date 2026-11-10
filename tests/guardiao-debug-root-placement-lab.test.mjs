import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const app=readFileSync('apps/mobile/App.tsx','utf8');
const py=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const lab=readFileSync('tooling/android/guardiao_debug_root_placement_lab.py','utf8');
const wf=readFileSync('.github/workflows/guardiao-debug-root-placement-lab.yml','utf8');

test('Debug-only root placement never serializes sizes or changes Release styles',()=>{
 assert.match(app,/recordLabRoot\(e\.nativeEvent\.layout\.height\)/);
 assert.match(app,/recordLabBottom\(e\.nativeEvent\.layout\.y,e\.nativeEvent\.layout\.height\)/);
 assert.match(app,/'-placement-' \+ labBottomPlacement/);
 assert.match(app,/if\(!__DEV__\)return/);
 assert.match(py,/def safe_debug_bottom_placement_category\(\) -> str:/);
 assert.match(py,/Debug root placement=/);
 assert.match(app,/bottom:\{height:76,paddingHorizontal:12,paddingBottom:4,/);
});
test('passive root placement diagnostic has no tap, OTA, release or sensitive uploads',()=>{
 assert.match(wf,/lab\/p01-guardiao-debug-root-placement-v1/);
 assert.match(wf,/assembleDebug/);
 assert.match(wf,/api-level: 28/);
 assert.match(wf,/contents: read/);
 assert.match(wf,/persist-credentials: false/);
 assert.match(wf,/guardiao_debug_root_placement_lab\.py/);
 assert.doesNotMatch(wf,/assembleRelease|workflow_dispatch|upload-artifact|eas update|secrets\./);
 assert.match(lab,/original\(\)  # Full independent real PDF/);
 assert.match(lab,/post-PDF root placement=/);
 assert.match(lab,/bottom-root-placement-unconfirmed/);
 assert.match(lab,/no navigation authorized/);
 assert.doesNotMatch(lab,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|print\(raw\)/);
});
test('root placement classification rejects incomplete or malformed evidence',()=>{
 const script=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_pdf_debug_metro_lab as x',
 'names=["home","pix","negresco"]',
 'rects=["[0,800][310,900]","[320,800][650,900]","[660,800][1000,900]"]',
 'def nodes(loc="inside-root"):',
 ' return [{"resource-id":"pkg:id/negresco-lab-tab-"+n+"-yoga-regular-bottom-regular-placement-"+loc,"package":"pkg","bounds":b,"clickable":"true","enabled":"true"} for n,b in zip(names,rects)]',
 'x.base.screen_size=lambda:(1080,960)',
 'x.base.xml_nodes=lambda:nodes()',
 'assert x.safe_debug_bottom_placement_category()=="testid-bottom-inside-root"',
 'assert x.safe_debug_testid_nav_geometry()=="testid-three-targets-bounded-readonly"',
 'assert x.safe_debug_testid_yoga_category()=="testid-yoga-all-regular"',
 'x.base.xml_nodes=lambda:nodes("overflows-root")',
 'assert x.safe_debug_bottom_placement_category()=="testid-bottom-overflows-root"',
 'x.base.xml_nodes=lambda:nodes("above-root")',
 'assert x.safe_debug_bottom_placement_category()=="testid-bottom-above-root"',
 'x.base.xml_nodes=lambda:nodes("unconfirmed")',
 'assert x.safe_debug_bottom_placement_category()=="testid-bottom-unconfirmed"',
 'x.base.xml_nodes=lambda:nodes()[:2]',
 'assert x.safe_debug_bottom_placement_category()=="testid-placement-nodes-unconfirmed"',
 'x.base.xml_nodes=lambda:nodes()+[nodes()[0]]',
 'assert x.safe_debug_bottom_placement_category()=="testid-placement-nodes-unconfirmed"',
 'x.base.xml_nodes=lambda:[dict(v,**{"resource-id":v["resource-id"].replace("-placement-inside-root","")}) for v in nodes()]',
 'assert x.safe_debug_bottom_placement_category()=="testid-placement-marker-unconfirmed"',
 'x.base.xml_nodes=lambda:(_ for _ in ()).throw(RuntimeError("SECRET_XML"))',
 'assert x.safe_debug_bottom_placement_category()=="testid-placement-collection-unconfirmed"',
 'print("PASS: root-placement strict categories")'
 ].join('\n');
 const result=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: root-placement strict categories/);
});
