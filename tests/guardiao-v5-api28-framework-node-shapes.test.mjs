import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync('.github/workflows/guardiao-v5-api28-framework-node-shapes.yml','utf8');
const script=readFileSync('tooling/android/guardiao_v5_api28_framework_node_shapes_lab.py','utf8');

test('same immutable synthetic Android9 candidate in four independent trials',()=>{
 for (const item of [
  'lab/p01-guardiao-v5-api28-framework-node-shapes-v1', 'trial: [1, 2, 3, 4]', 'api: [28]',
  'run-id: 43789332636', 'fail-fast: false',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'CN=Android Debug', 'sha256sum --check --strict',
  'script: python3 tooling/android/guardiao_v5_api28_framework_node_shapes_lab.py', 'persist-credentials: false',
  'contents: read','actions: read',
 ]) assert.ok(workflow.includes(item),item);
 assert.doesNotMatch(workflow,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
});

test('one in-memory observation per prior snapshot, never changes original verdict',()=>{
 for(const item of ['original = prior.classify','prior.classify = observe_existing_nodes',
  'return original(nodes, width, height)', 'prior.classify = original',
  'prior.run()', 'len(nodes) > 2500']) assert.ok(script.includes(item),item);
 const a=script.indexOf('def classify('),b=script.indexOf('\ndef run()',a);
 assert.ok(a>=0&&b>a);
 assert.doesNotMatch(script.slice(a,b),/\.adb\(|\.xml_nodes\(|print\(|sleep\(|tap\(|swipe\(/);
 assert.doesNotMatch(script,/print\(nodes\)|print\(n\)|print\(bound\)|print\(resource\)/);
});

test('framework categories classify synthetic bounded shapes without raw UI output',()=>{
 const src=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_v5_api28_framework_node_shapes_lab as d',
  "def n(pkg='android',cls='android.widget.TextView',bounds='[0,0][400,800]',click='true',rid='android:id/title',focused='false'): return {'package':pkg,'class':cls,'bounds':bounds,'clickable':click,'resource-id':rid,'focused':focused}",
  "assert d.classify([n()],400,800)==('present','present','absent','present','absent','present','large-node-present')",
  "assert d.classify([n(bounds='[1,2][11,12]')],400,800)==('present','present','absent','present','absent','present','bounded-nodes-only')",
  "assert d.classify([n(bounds='garbled')],400,800)==('present','present','absent','present','absent','present','bounds-unconfirmed')",
  "assert d.classify([n(cls='android.widget.Button',focused='true')],400,800)==('present','absent','present','present','present','present','large-node-present')",
  "assert d.classify([n(rid='android:id/title-evasion',bounds='[0,0][400,800]')],400,800)[5]=='present'",
  "assert d.classify([n(rid='android.evil:id/title')],400,800)[5]=='absent'",
  "assert d.classify([n(pkg='com.negresco.finance')],400,800)==('absent',)*7",
  "assert d.classify([n(pkg='android.evil')],400,800)==('absent',)*7",
  "assert d.classify([123],400,800)==('unconfirmed',)*7",
  "assert d.classify(None,400,800)==('unconfirmed',)*7",
  "print('PASS (LAB): framework-only classes and geometry synthetic')",
 ].join('\n');
 const out=spawnSync('python3',['-c',src],{encoding:'utf8',timeout:20000});
 assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/PASS \(LAB\): framework-only classes/);
});

test('original classifier restored when downstream fails; no Android run',()=>{
 const src=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_v5_api28_framework_node_shapes_lab as d',
  'old=d.prior.classify; previous=d.prior.run',
  'def stub():',
  "    result=d.prior.classify([{'package':'android','class':'android.widget.Button','bounds':'[0,0][400,800]'}],400,800)",
  '    assert type(result) is tuple',
  "    raise RuntimeError('synthetic-block')",
  'd.prior.run=stub',
  'try:',
  '    try: d.run()',
  '    except RuntimeError: pass',
  "    else: raise AssertionError('should propagate')",
  'finally: d.prior.run=previous',
  'assert d.prior.classify is old',
  "print('PASS (LAB): framework wrapper restores original verifier')",
 ].join('\n');
 const out=spawnSync('python3',['-c',src],{encoding:'utf8',timeout:20000});
 assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/PASS \(LAB\): framework wrapper restores original verifier/);
});
