import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const app=readFileSync('apps/mobile/App.tsx','utf8');
const runner=readFileSync('tooling/android/guardiao_debug_role_button_probe_lab.py','utf8');
const wf=readFileSync('.github/workflows/guardiao-debug-role-button-probe-lab.yml','utf8');

test('only Debug changes native accessibility tab role, existing Release role stays tab',()=>{
 assert.match(app,/accessibilityRole=\{__DEV__ \? "button" : "tab"\}/);
 assert.match(app,/accessibilityState=\{\{selected:page===x\.name\}\}/);
 assert.match(app,/style=\{\[s\.nav,__DEV__&&s\.labNavBounds,page===x\.name&&s\.navSelected\]\}/);
 assert.match(app,/bottom:\{height:76,paddingHorizontal:12,paddingBottom:4,/);
 assert.match(app,/nav:\{width:'31%',alignItems:'center',justifyContent:'center',borderRadius:18,marginVertical:6\}/);
});
test('isolated A/B is passive, detects either outcome and forbids PDF, OTA, taps',()=>{
 assert.match(wf,/lab\/p01-guardiao-debug-role-button-probe-v1/);
 assert.match(wf,/guardiao_debug_role_button_probe_lab\.py/);
 assert.match(wf,/assembleDebug/);
 assert.match(wf,/api-level: 28/);
 assert.match(wf,/contents: read/);
 assert.match(wf,/persist-credentials: false/);
 assert.doesNotMatch(wf,/assembleRelease|workflow_dispatch|upload-artifact|eas update|secrets\./);
 assert.match(runner,/debug\.debug_digest\(\)/);
 assert.match(runner,/button-role native bounds=/);
 assert.match(runner,/testid-three-targets-bounded-readonly/);
 assert.match(runner,/testid-three-targets-thin/);
 assert.match(runner,/native-target-not-thin/);
 assert.match(runner,/NO navigation approval/);
 assert.doesNotMatch(runner,/BASE\.adb\("shell", "input"|BASE\.tap_node|BASE\.scroll_forward|BASE\.scroll_backward|screencap|print\(raw\)|pm", "clear"|force-stop/);
});
test('native ancestry classifier handles thin and large synthetic parents without leaks',()=>{
 const script=[
   'import sys',
   "sys.path.insert(0,'tooling/android')",
   'import guardiao_debug_role_button_probe_lab as x',
   'names=x.TARGETS',
   'def xml(tall):',
   '  p="[0,790][1080,930]" if tall else "[0,0][1080,960]"',
   "  parts=[]",
   '  for i,n in enumerate(names):',
   '    t="p:id/"+n+"-yoga-regular-bottom-regular-placement-inside-root"',
   '    b="["+str(i*350)+",820]["+str(i*350+300)+",835]"',
   '    parts.append("<node package="+chr(34)+"p"+chr(34)+" bounds="+chr(34)+p+chr(34)+"><node package="+chr(34)+"p"+chr(34)+" clickable="+chr(34)+"true"+chr(34)+" enabled="+chr(34)+"true"+chr(34)+" resource-id="+chr(34)+t+chr(34)+" bounds="+chr(34)+b+chr(34)+"/></node>")',
   '  return "<hierarchy>"+"".join(parts)+"</hierarchy>"',
   'assert x.classify_native_ancestors(xml(True),1080,960)=="native-three-thin-with-taller-bottom-ancestors"',
   'assert x.classify_native_ancestors(xml(False),1080,960)=="native-three-thin-no-taller-bottom-ancestors"',
   'assert x.classify_native_ancestors("<private",1080,960)=="native-tree-unconfirmed"',
   'print("PASS: readonly parent categories")'
 ].join('\n');
 const result=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: readonly parent categories/);
});
