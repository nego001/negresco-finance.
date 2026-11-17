import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const w=readFileSync('.github/workflows/guardiao-v5-api28-framework-resource-signals.yml','utf8');
const p=readFileSync('tooling/android/guardiao_v5_api28_framework_resource_signals_lab.py','utf8');

test('fixed APK with four independent Android 9 trials, no release or write permissions',()=>{
 for(const item of [
  'lab/p01-guardiao-v5-api28-framework-resource-signals-v1', 'trial: [1, 2, 3, 4]', 'api: [28]',
  'run-id: 43789332636', 'fail-fast: false',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'CN=Android Debug', 'sha256sum --check --strict',
  'script: python3 tooling/android/guardiao_v5_api28_framework_resource_signals_lab.py', 'persist-credentials: false',
  'contents: read','actions: read',
 ])assert.ok(w.includes(item),item);
 assert.doesNotMatch(w,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
});

test('only classifies already-collected nodes and restores the original gate',()=>{
 for(const item of [
  'original = previous.classify', 'previous.classify = classify_existing',
  'return original(nodes, width, height)','previous.classify = original',
  'previous.run()', 'len(nodes) > 2500',
 ])assert.ok(p.includes(item),item);
 const a=p.indexOf('def classify('), b=p.indexOf('\ndef run()',a);
 assert.ok(a>=0 && b>a);
 assert.doesNotMatch(p.slice(a,b),/\.adb\(|\.xml_nodes\(|print\(|sleep\(|tap\(|swipe\(/);
 assert.doesNotMatch(p,/print\(nodes\)|print\(node\)|print\(key\)/);
});

test('resolver, chooser, dialog, list, choice and clickable signals are independent',()=>{
 const src=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_v5_api28_framework_resource_signals_lab as d',
  "def n(rid='',klass='android.view.View',pkg='android',click='false'): return {'package':pkg,'resource-id':rid,'class':klass,'clickable':click}",
  "assert d.classify([n('android:id/resolver_list')],400,800)==('present','absent','absent','absent','absent','none')",
  "assert d.classify([n('com.android.internal:id/chooser_grid')],400,800)==('absent','present','absent','absent','absent','none')",
  "assert d.classify([n('android:id/contentPanel')],400,800)==('absent','absent','present','absent','absent','none')",
  "assert d.classify([n(klass='android.widget.GridView')],400,800)==('absent','absent','absent','present','absent','none')",
  "assert d.classify([n(klass='android.widget.RadioButton',click='true')],400,800)==('absent','absent','absent','absent','present','one')",
  "assert d.classify([n(click='true'),n(click='true')],400,800)==('absent','absent','absent','absent','absent','multiple')",
  "assert d.classify([n('malicious:id/resolver_list')],400,800)==('absent','absent','absent','absent','absent','none')",
  "assert d.classify([n('android:id/resolver_list',pkg='com.negresco.finance')],400,800)==('absent','absent','absent','absent','absent','none')",
  "assert d.classify([],400,800)==('absent','absent','absent','absent','absent','none')",
  "assert d.classify(None,400,800)==('unconfirmed',)*6",
  "assert d.classify([2],400,800)==('unconfirmed',)*6",
  "print('PASS (LAB): fixed framework resource categories')",
 ].join('\n');
 const z=spawnSync('python3',['-c',src],{encoding:'utf8',timeout:20000});
 assert.equal(z.status,0,z.stderr);
 assert.match(z.stdout,/PASS \(LAB\): fixed framework resource categories/);
});

test('a downstream exception cannot leave a wrapper installed or authorize a return',()=>{
 const src=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_v5_api28_framework_resource_signals_lab as d',
  'original=d.previous.classify; previous=d.previous.run',
  'def fail():',
  "    result=d.previous.classify([{'package':'android','resource-id':'android:id/resolver_list'}],400,800)",
  '    assert type(result) is tuple',
  "    raise RuntimeError('synthetic-block')",
  'd.previous.run=fail',
  'try:',
  '    try: d.run()',
  '    except RuntimeError: pass',
  "    else: raise AssertionError('must block')",
  'finally: d.previous.run=previous',
  'assert d.previous.classify is original',
  "print('PASS (LAB): original gate preserved')",
 ].join('\n');
 const z=spawnSync('python3',['-c',src],{encoding:'utf8',timeout:20000});
 assert.equal(z.status,0,z.stderr);
 assert.match(z.stdout,/PASS \(LAB\): original gate preserved/);
});
