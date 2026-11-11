import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const code=readFileSync('tooling/android/guardiao_native_ancestor_readonly_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-native-ancestor-readonly-lab.yml','utf8');

test('native ancestor inspection is read-only and cannot trigger PDF or Release',()=>{
 assert.match(workflow,/lab\/p01-guardiao-native-ancestor-readonly-v1/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_native_ancestor_readonly_lab\.py/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|workflow_dispatch|contents: write|secrets\./);
 assert.match(code,/debug\.debug_digest\(\)/);
 assert.match(code,/BASE\.wait_visible\("Seu universo", retries=45\)/);
 assert.match(code,/native-three-thin-with-taller-bottom-ancestors/);
 assert.match(code,/two stable home-only native snapshots; no PDF or gestures/);
 assert.doesNotMatch(code,/BASE\.adb\("shell", "input"|BASE\.tap_node|BASE\.scroll_forward|BASE\.scroll_backward|print\(raw\)|screencap|force-stop|pm", "clear"/);
});
test('synthetic native hierarchy validates parent size, target uniqueness and malformed XML',()=>{
 const script=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_native_ancestor_readonly_lab as x',
 'names=x.TARGETS',
 'def tree(tall=True,omit=False,duplicate=False):',
 ' b="".join("<node package=\\"p\\" class=\\"android.view.View\\" bounds=\\"[0,790][1080,930]\\"><node package=\\"p\\" clickable=\\"true\\" enabled=\\"true\\" resource-id=\\"p:id/"+n+"-yoga-regular-bottom-regular-placement-inside-root\\" bounds=\\"["+str(i*350)+",820]["+str(i*350+300)+",835]\\" /></node>" for i,n in enumerate(names) if not (omit and i==2))',
 ' if not tall:b=b.replace("bounds=\\"[0,790][1080,930]\\"","bounds=\\"[0,0][1080,960]\\"")',
 ' if duplicate:b=b+b.split("</node>")[0]+"</node>"',
 ' return "<hierarchy>"+b+"</hierarchy>"',
 'assert x.classify_native_ancestors(tree(),1080,960)=="native-three-thin-with-taller-bottom-ancestors"',
 'assert x.classify_native_ancestors(tree(tall=False),1080,960)=="native-three-thin-no-taller-bottom-ancestors"',
 'assert x.classify_native_ancestors(tree(omit=True),1080,960)=="native-three-targets-unconfirmed"',
 'assert x.classify_native_ancestors("<PRIVATE_XML",1080,960)=="native-tree-unconfirmed"',
 'print("PASS: native ancestor categories strict")'
 ].join('\n');
 const result=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: native ancestor categories strict/);
});
