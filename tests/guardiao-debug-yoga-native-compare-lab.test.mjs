import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const app=readFileSync('apps/mobile/App.tsx','utf8');
const py=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const runner=readFileSync('tooling/android/guardiao_debug_yoga_native_compare_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-yoga-native-compare-lab.yml','utf8');

test('Debug Yoga classification is attached to existing tab native ids only',()=>{
  assert.match(app,/setLabYogaMeasured\(prev=>prev\[key\]===category/);
  assert.match(app,/'-yoga-' \+ \(labYogaMeasured\[/);
  assert.match(app,/'-bottom-' \+ \(labYogaMeasured\.bottom/);
  assert.match(app,/testID=\{__DEV__ \? \('negresco-lab-tab-'/);
  assert.match(app,/if\(!__DEV__\)return/);
  assert.match(py,/def safe_debug_testid_yoga_category\(\) -> str:/);
  assert.match(py,/ENV \(LAB\): Debug testid Yoga=/);
});
test('passive diagnostic retains synthetic proof and never authorizes a tap',()=>{
  assert.match(workflow,/lab\/p01-guardiao-debug-yoga-native-compare-v1/);
  assert.match(workflow,/script: python3 tooling\/android\/guardiao_debug_yoga_native_compare_lab.py/);
  assert.match(workflow,/api-level: 28/);
  assert.match(workflow,/contents: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|workflow_dispatch|eas update|secrets\./);
  assert.match(runner,/original\(\)  # Full independent real PDF/);
  assert.match(runner,/diagnostic classifications observed; no navigation authorized/);
  assert.doesNotMatch(runner,/BASE\.adb|input", "tap"|input", "swipe"|force-stop|pm", "clear"|print\(raw\)/);
});
test('native categorical testIDs distinguish regular, thin, unknown and malformed evidence',()=>{
 const script=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_pdf_debug_metro_lab as x',
  'names=["home","pix","negresco"]',
  'rects=["[0,800][310,900]","[320,800][650,900]","[660,800][1000,900]"]',
  'def nodes(tab="regular",parent="regular"):',
  ' return [{"resource-id":"com.test:id/negresco-lab-tab-"+n+"-yoga-"+tab+"-bottom-"+parent,"package":"com.test","bounds":b,"clickable":"true","enabled":"true"} for n,b in zip(names,rects)]',
  'x.base.screen_size=lambda:(1080,960)',
  'x.base.xml_nodes=lambda:nodes()',
  'assert x.safe_debug_testid_yoga_category()=="testid-yoga-all-regular"',
  'assert x.safe_debug_testid_nav_geometry()=="testid-three-targets-bounded-readonly"',
  'x.base.xml_nodes=lambda:nodes("thin")',
  'assert x.safe_debug_testid_yoga_category()=="testid-yoga-some-thin"',
  'x.base.xml_nodes=lambda:nodes(parent="thin")',
  'assert x.safe_debug_testid_yoga_category()=="testid-yoga-some-thin"',
  'x.base.xml_nodes=lambda:nodes("unconfirmed")',
  'assert x.safe_debug_testid_yoga_category()=="testid-yoga-unconfirmed"',
  'x.base.xml_nodes=lambda:nodes()[:2]',
  'assert x.safe_debug_testid_yoga_category()=="testid-yoga-nodes-unconfirmed"',
  'x.base.xml_nodes=lambda:[dict(v,**{"resource-id":"com.test:id/negresco-lab-tab-"+n}) for v,n in zip(nodes(),names)]',
  'assert x.safe_debug_testid_yoga_category()=="testid-yoga-marker-unconfirmed"',
  'x.base.xml_nodes=lambda:(_ for _ in ()).throw(RuntimeError("PRIVATE_UI_XML"))',
  'assert x.safe_debug_testid_yoga_category()=="testid-yoga-collection-unconfirmed"',
  'print("PASS: fixed Yoga/testID categories, no geometry emitted")'
 ].join('\n');
 const result=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: fixed Yoga\/testID categories/);
});
