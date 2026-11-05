import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync('.github/workflows/guardiao-original-release-api28-retained-state-lab.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_original_release_retained_state_lab.py','utf8');
const auditor=readFileSync('tooling/android/verify_guardiao_api28_two_cycle_receipts.py','utf8');

test('same-APK retained-state Android 9 lab preserves original SHA, receiver and privacy boundaries',()=>{
 assert.match(workflow,/branches:\s*\n\s+- lab\/p01-guardiao-debug-metro-phase-v1/);
 assert.match(workflow,/name: negresco-finance-v313-security-preview/);
 assert.match(workflow,/run-id: 40617164086/);
 assert.match(workflow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
 assert.equal((workflow.match(/sha256sum --check --strict/g)||[]).length,2);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/python3 tooling\/android\/guardiao_original_release_retained_state_lab\.py/);
 assert.match(workflow,/needs: android-api28-retained-state/);
 assert.match(workflow,/verify_guardiao_api28_two_cycle_receipts\.py retained-state-review/);
 assert.match(workflow,/name: guardiao-api28-retained-state-metadata-unreviewed/);
 assert.match(workflow,/path: retained-state-receipts\//);
 assert.match(workflow,/retention-days: 2/);
 assert.doesNotMatch(workflow,/workflow_dispatch|assembleRelease|eas update|upload-apk|signingConfig|secrets\./i);
 assert.doesNotMatch(workflow,/path:\s*[^\n]*(?:\.apk|\.pdf|logcat|screenshots?)/i);
 assert.match(runner,/CYCLES = \("a", "b"\)/);
 assert.match(runner,/OUT = Path\("retained-state-receipts"\)/);
 assert.match(runner,/base\.EXPECTED_SHA != receipt\.APK_SHA/);
 assert.match(runner,/replay\.FIXTURE != "8" \+ "0" \* 47/);
 assert.match(runner,/if index:\s*\n\s*base\.adb\("shell", "am", "force-stop", base\.PACKAGE/);
 assert.match(runner,/base\.adb\("shell", "pidof", base\.PACKAGE/);
 assert.match(runner,/if base\.adb[\s\S]{0,150}\.strip\(\):\s*\n\s*raise RuntimeError\("retained-state process stop unconfirmed"\)/);
 assert.doesNotMatch(runner,/pm", "clear"|uninstall|adb\("shell", "rm"|delete|install", "-r"/);
 assert.equal((runner.match(/replay\.run\(\)/g)||[]).length,2); // one code call plus comment
 assert.match(runner,/semantic\.observed = None/);
 assert.match(runner,/semantic\.REPORT\.replace\(folder \/ receipt\.MEMBER\)/);
 assert.match(runner,/receipt\.verify\(parsed, 28\)/);
 assert.match(auditor,/receipt\.verify\(parsed, 28\)/);
 assert.match(auditor,/read_member_at\(folder_fd\)/);
});

test('retained-state runner verifies both receipts and fails closed if Android process cannot stop',()=>{
 const py=[
  'import os,sys,tempfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_original_release_retained_state_lab as x',
  'with tempfile.TemporaryDirectory() as d:',
  '  os.chdir(d)',
  '  x.OUT=Path("retained-state-receipts")',
  '  x.semantic.REPORT=Path("receipt.json")',
  '  calls=[]',
  '  def adb(*args,**kwargs):',
  '    calls.append(tuple(args))',
  '    return ""',
  '  def replay():',
  '    calls.append(("run",))',
  '    x.semantic.REPORT.write_text("{}")',
  '  x.base.adb=adb',
  '  x.replay.run=replay',
  '  x.receipt.read_receipt=lambda path: {}',
  '  x.receipt.verify=lambda evidence,api: None',
  '  x.run()',
  '  pkg=x.base.PACKAGE',
  '  assert calls==[("run",),("shell","am","force-stop",pkg),("shell","pidof",pkg),("run",)],calls',
  '  assert set(p.name for p in x.OUT.iterdir())=={"cycle-a","cycle-b"}',
  '  assert all((x.OUT/("cycle-"+c)/x.receipt.MEMBER).is_file() for c in ("a","b"))',
  '  x.OUT=Path("stop-blocked")',
  '  calls=[]',
  '  def fail_adb(*args,**kwargs):',
  '    calls.append(tuple(args))',
  '    return "123" if args[:2]==("shell","pidof") else ""',
  '  x.base.adb=fail_adb',
  '  try: x.run()',
  '  except RuntimeError as e: assert str(e)=="retained-state process stop unconfirmed"',
  '  else: raise AssertionError("unchecked process stop")',
  '  assert calls==[("run",),("shell","am","force-stop",pkg),("shell","pidof",pkg)],calls',
  '  assert not (x.OUT/"cycle-b").exists()',
  'print("PASS: retained state process restart and both receipt boundaries verified")'
 ].join('\n');
 const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: retained state process restart and both receipt boundaries verified/);
});
