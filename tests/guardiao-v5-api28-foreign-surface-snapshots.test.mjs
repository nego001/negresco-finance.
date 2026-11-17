import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow = readFileSync('.github/workflows/guardiao-v5-api28-foreign-surface-snapshots.yml', 'utf8');
const source = readFileSync('tooling/android/guardiao_v5_api28_foreign_surface_snapshots_lab.py', 'utf8');

test('four Android9 trials preserve exact SHA, no production actions and strict double snapshot', () => {
 for (const item of [
  'lab/p01-guardiao-v5-api28-foreign-surface-snapshots-v1', 'trial: [1, 2, 3, 4]', 'api: [28]',
  'run-id: 43789332636', 'fail-fast: false',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'CN=Android Debug', 'sha256sum --check --strict',
  'script: python3 tooling/android/guardiao_v5_api28_foreign_surface_snapshots_lab.py', 'persist-credentials: false',
  'contents: read', 'actions: read',
 ]) assert.ok(workflow.includes(item), item);
 assert.doesNotMatch(workflow, /contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
});

test('only uses the existing in-memory nodes, returns original verdict, restores wrapper', () => {
 for (const item of [
  'original = scope.classify', 'scope.classify = classify_existing_nodes',
  'return original(nodes, width, height)', 'scope.classify = original',
  'scope.run()', 'len(nodes) > 2500',
 ]) assert.ok(source.includes(item), item);
 const begin = source.indexOf('def classify('), end = source.indexOf('\ndef run()', begin);
 assert.ok(begin >= 0 && end > begin);
 assert.doesNotMatch(source.slice(begin,end), /\.adb\(|\.xml_nodes\(|print\(|sleep\(|tap\(|swipe\(/);
 assert.doesNotMatch(source, /print\(nodes\)|print\(node\)|print\(package\)/);
});

test('exact package categories exclude lookalikes and do not expose unknown names', () => {
 const script=[
  'import sys',
  "sys.path.insert(0, 'tooling/android')",
  'import guardiao_v5_api28_foreign_surface_snapshots_lab as d',
  "def n(p): return {'package':p,'class':'android.view.View'}",
  "assert d.classify([n('android')],400,800)==('absent','present','absent','absent','absent','absent','absent')",
  "assert d.classify([n('com.negresco.pdfreceiver.lab')],400,800)==('present','absent','absent','absent','absent','absent','absent')",
  "assert d.classify([n('com.android.systemui')],400,800)==('absent','absent','present','absent','absent','absent','absent')",
  "assert d.classify([n('com.android.launcher3')],400,800)==('absent','absent','absent','present','absent','absent','absent')",
  "assert d.classify([n('com.google.android.inputmethod.latin')],400,800)==('absent','absent','absent','absent','present','absent','absent')",
  "assert d.classify([n('com.google.android.documentsui')],400,800)==('absent','absent','absent','absent','absent','present','absent')",
  "assert d.classify([n('com.android.systemui.evil')],400,800)==('absent','absent','absent','absent','absent','absent','present')",
  "assert d.classify([n('other.unknown'),n('android')],400,800)==('absent','present','absent','absent','absent','absent','present')",
  "assert d.classify([n(d.scope.existing.scoped.BASE.PACKAGE)],400,800)==('absent',)*7",
  "assert d.classify([n('')],400,800)==('unconfirmed',)*7",
  "assert d.classify(None,400,800)==('unconfirmed',)*7",
  "assert d.classify([],400,800)==('absent',)*7",
  "print('PASS (LAB): foreign surface owner allowlist classified')",
 ].join('\n');
 const result=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS \(LAB\): foreign surface owner allowlist classified/);
});

test('fail-closed downstream error still restores original classifier',()=>{
 const script=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_v5_api28_foreign_surface_snapshots_lab as d',
  'original=d.scope.classify',
  'original_run=d.scope.run',
  'def fail():',
  "    got=d.scope.classify([{'package':'android','class':'android.view.View'}],400,800)",
  '    assert type(got) is tuple',
  "    raise RuntimeError('synthetic-block')",
  'd.scope.run=fail',
  'try:',
  '    try: d.run()',
  '    except RuntimeError: pass',
  "    else: raise AssertionError('must block')",
  'finally: d.scope.run=original_run',
  'assert d.scope.classify is original',
  "print('PASS (LAB): original verifier kept fail-closed')",
 ].join('\n');
 const result=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS \(LAB\): original verifier kept fail-closed/);
});
