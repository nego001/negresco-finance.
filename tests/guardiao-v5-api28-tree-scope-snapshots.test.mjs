import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const w = readFileSync('.github/workflows/guardiao-v5-api28-tree-scope-snapshots.yml', 'utf8');
const p = readFileSync('tooling/android/guardiao_v5_api28_tree_scope_snapshots_lab.py', 'utf8');

test('four Android9 trials retain fixed APK, double-snapshot gate and read-only permissions', () => {
  for (const part of [
    'lab/p01-guardiao-v5-api28-tree-scope-snapshots-v1', 'trial: [1, 2, 3, 4]', 'api: [28]',
    'run-id: 43789332636', 'fail-fast: false',
    '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
    'CN=Android Debug', 'sha256sum --check --strict',
    'script: python3 tooling/android/guardiao_v5_api28_tree_scope_snapshots_lab.py', 'persist-credentials: false',
    'contents: read', 'actions: read',
  ]) assert.ok(w.includes(part), part);
  assert.doesNotMatch(w, /contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
});

test('reuses cardinality snapshots and returns original verdict, no reads, sleeps or inputs', () => {
  for (const part of [
    'original = existing.classify', 'existing.classify = describe_read_only',
    'return original(nodes, width, height)', 'existing.classify = original',
    'existing.run()', 'existing.scoped.BASE.PACKAGE',
    'existing.NAMES', 'len(nodes) > 2500',
  ]) assert.ok(p.includes(part), part);
  const start = p.indexOf('def classify('), end = p.indexOf('\ndef run()', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(p.slice(start, end), /\.adb\(|\.xml_nodes\(|print\(|sleep\(|input|tap|swipe/i);
  assert.doesNotMatch(p, /print\(nodes\)|print\(node\)|print\(raw\)/);
});

test('distinguishes empty tree, external-only, app-without-labels and intact app using synthetic nodes', () => {
  const script = [
    "import sys",
    "sys.path.insert(0, 'tooling/android')",
    "import guardiao_v5_api28_tree_scope_snapshots_lab as d",
    "pkg=d.existing.scoped.BASE.PACKAGE",
    "def n(p,c,t=''): return {'package':p,'class':c,'text':t}",
    "assert d.classify([],400,800)==('empty','absent','absent','absent','absent','absent')",
    "assert d.classify([n('other.pkg','android.view.View')],400,800)==('nonempty','absent','absent','absent','present','absent')",
    "assert d.classify([n(pkg,'android.view.View')],400,800)==('nonempty','present','absent','absent','absent','present')",
    "assert d.classify([n(pkg,'android.view.View'),n(pkg,'android.widget.TextView','synthetic heading')],400,800)==('nonempty','present','present','present','absent','present')",
    "assert d.classify([n(pkg,'android.widget.TextView','Início'),n(pkg,'android.widget.TextView','Pix'),n(pkg,'android.widget.TextView','Negresco')],400,800)==('nonempty','present','present','absent','absent','absent')",
    "assert d.classify(None,400,800)==('unconfirmed',)*6",
    "assert d.classify([123],400,800)==('unconfirmed',)*6",
    "print('PASS (LAB): sanitized accessibility tree categories')",
  ].join('\n');
  const result = spawnSync('python3', ['-c', script], {encoding:'utf8', timeout:20000});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS \(LAB\): sanitized accessibility tree categories/);
});

test('restores classification wrapper even when downstream gate blocks; no Android used', () => {
  const script = [
    'import sys',
    "sys.path.insert(0,'tooling/android')",
    'import guardiao_v5_api28_tree_scope_snapshots_lab as d',
    'old=d.existing.classify; run=d.existing.run',
    "def fake_run():",
    "    p=d.existing.scoped.BASE.PACKAGE",
    "    result=d.existing.classify([{'package':p,'class':'android.view.View'}],400,800)",
    "    assert type(result) is tuple",
    "    raise RuntimeError('synthetic block')",
    "d.existing.run=fake_run",
    "try:",
    "    try: d.run()",
    "    except RuntimeError: pass",
    "    else: raise AssertionError('must propagate block')",
    "finally: d.existing.run=run",
    "assert d.existing.classify is old",
    "print('PASS (LAB): original gate retained and wrapper restored')",
  ].join('\n');
  const result = spawnSync('python3', ['-c', script], {encoding:'utf8', timeout:20000});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/PASS \(LAB\): original gate retained and wrapper restored/);
});
