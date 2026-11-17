import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync('.github/workflows/guardiao-v5-api28-resolver-focus-readonly.yml','utf8');
const src=readFileSync('tooling/android/guardiao_v5_api28_resolver_focus_readonly_lab.py','utf8');

function python(script){
  const p=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:25000});
  assert.equal(p.status,0,p.stderr);
  return p.stdout;
}

test('eight disposable Android9 trials pin exact Debug test APK, with no production writes',()=>{
 for(const needle of [
   'lab/p01-guardiao-v5-api28-resolver-focus-readonly-v1', 'trial: [1, 2, 3, 4, 5, 6, 7, 8]',
   'api: [28]', 'fail-fast: false', 'run-id: 43789332636',
   '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
   'CN=Android Debug', 'sha256sum --check --strict',
   '-no-snapshot', 'persist-credentials: false',
   'script: python3 tooling/android/guardiao_v5_api28_resolver_focus_readonly_lab.py', 'contents: read', 'actions: read',
 ]) assert.ok(workflow.includes(needle),needle);
 assert.doesNotMatch(workflow,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
});

test('read only on exact pre-existing resolver/chooser marker, never on app/unknown',()=>{
 const output=python([
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'import guardiao_v5_api28_resolver_focus_readonly_lab as d',
  "app=[{'package':d.home.base.PACKAGE,'class':'android.widget.TextView'}]",
  "framework=[{'package':'android','resource-id':'android:id/resolver_list','class':'android.widget.ListView'}]",
  "chooser=[{'package':'android','resource-id':'com.android.internal:id/chooser_grid','class':'android.widget.GridView'}]",
  "other=[{'package':'android','resource-id':'android:id/contentPanel','class':'android.widget.TextView'}]",
  "window='mCurrentFocus=Window{abc u0 android/com.android.internal.app.ResolverActivity}'",
  "with patch.object(d.home.base,'adb',return_value=window) as adb:",
  "    assert d.observe(app,400,800)==('resolver-marker-absent','focus-not-sampled')",
  "    assert d.observe(other,400,800)==('resolver-marker-absent','focus-not-sampled')",
  "    assert d.observe([],400,800)==('resolver-marker-absent','focus-not-sampled')",
  "    assert d.observe(None,400,800)==('unconfirmed','focus-not-sampled')",
  '    assert adb.call_count==0',
  "    assert d.observe(framework,400,800)==('resolver-marker-present','window-focus-chooser')",
  "    assert d.observe(chooser,400,800)==('resolver-marker-present','window-focus-chooser')",
  '    assert adb.call_count==2',
  "    for call in adb.call_args_list: assert call.args==('shell','dumpsys','window','windows') and call.kwargs=={'timeout':8,'check':False}",
  "print('PASS (LAB): conditional focus sampling validated')",
 ].join('\n'));
 assert.match(output,/PASS \(LAB\): conditional focus sampling validated/);
});

test('no raw dumpsys text or exception escapes and parser categories are allowlisted',()=>{
 const output=python([
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'import guardiao_v5_api28_resolver_focus_readonly_lab as d',
  "nodes=[{'package':'android','resource-id':'android:id/resolver_list'}]",
  "raw='mCurrentFocus=Window{abc u0 com.negresco.finance/.MainActivity}'",
  "with patch.object(d.home.base,'adb',return_value=raw): assert d.observe(nodes,400,800)==('resolver-marker-present','window-focus-app')",
  "with patch.object(d.home.base,'adb',return_value='mCurrentFocus=null'): assert d.observe(nodes,400,800)==('resolver-marker-present','window-focus-null')",
  "with patch.object(d.home.base,'adb',return_value='mCurrentFocus=Window{abc u0 other.pkg/.OtherActivity}'): assert d.observe(nodes,400,800)==('resolver-marker-present','window-focus-other')",
  "with patch.object(d.home.base,'adb',return_value='unparsable'): assert d.observe(nodes,400,800)==('resolver-marker-present','window-focus-unconfirmed')",
  "with patch.object(d.home.base,'adb',side_effect=RuntimeError('synthetic secret')): assert d.observe(nodes,400,800)==('resolver-marker-present','window-focus-unconfirmed')",
  "print('PASS (LAB): focus categories are bounded')",
 ].join('\n'));
 assert.match(output,/PASS \(LAB\): focus categories are bounded/);
 assert.doesNotMatch(output,/synthetic secret|MainActivity|other.pkg/);
});

test('wrapper leaves original verdict untouched and is always restored after BLOCK',()=>{
 const output=python([
  'import sys,io,contextlib',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'import guardiao_v5_api28_resolver_focus_readonly_lab as d',
  "nodes=[{'package':'android','resource-id':'android:id/resolver_list','class':'android.widget.ListView'}]",
  "original=d.resource.classify",
  "focus='mCurrentFocus=Window{abc u0 android/com.android.internal.app.ChooserActivity}'",
  'def fail():',
  '    with patch.object(d.home.base,\'adb\',return_value=focus) as adb:',
  '        assert d.resource.classify(nodes,400,800)==original(nodes,400,800)',
  '        assert adb.call_count==1',
  "    raise RuntimeError('synthetic downstream block')",
  'buffer=io.StringIO()',
  'with patch.object(d.resource,\'run\',side_effect=fail):',
  '    try:',
  '        with contextlib.redirect_stdout(buffer): d.run()',
  '    except RuntimeError: pass',
  "    else: raise AssertionError('must propagate BLOCK')",
  'assert d.resource.classify is original',
  "assert 'resolver-snapshot=resolver-marker-present focus-after-snapshot=window-focus-chooser' in buffer.getvalue()",
  "assert 'ChooserActivity' not in buffer.getvalue()",
  "print('PASS (LAB): original gate and wrapper restoration verified')",
 ].join('\n'));
 assert.match(output,/PASS \(LAB\): original gate and wrapper restoration verified/);
});

test('only one additional bounded read on anomaly; no gestures or new XML dumps',()=>{
 const begin=src.indexOf('def observe('),end=src.indexOf('\ndef run()',begin);
 assert.ok(begin>=0&&end>begin);
 const probe=src.slice(begin,end);
 assert.match(probe,/home\.base\.adb\("shell", "dumpsys", "window", "windows"/);
 assert.match(probe,/timeout=8, check=False/);
 assert.doesNotMatch(probe,/\.xml_nodes\(|uiautomator|\binput\b|\btap\b|swipe|sleep\(|logcat|screenshot|print\(/);
 for(const needle of ['resource.classify = inspect_existing_snapshot',
   'return original(nodes, width, height)', 'resource.classify = original',
   'resource.run()', 'resolver_trigger(nodes, width, height)']) assert.ok(src.includes(needle),needle);
});
