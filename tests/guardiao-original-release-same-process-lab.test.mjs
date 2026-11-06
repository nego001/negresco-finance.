import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const script=readFileSync('tooling/android/guardiao_original_release_same_process_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-original-release-api28-same-process-lab.yml','utf8');
const common=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');

test('API28 same-process lab checks original APK and forbids reinstallation after cycle one',()=>{
 assert.match(workflow,/lab\/p01-guardiao-debug-metro-phase-v1/);
 assert.match(workflow,/run-id: 40617164086/);
 assert.match(workflow,/name: negresco-finance-v313-security-preview/);
 assert.match(workflow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
 assert.equal((workflow.match(/sha256sum --check --strict/g)||[]).length,2);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_original_release_same_process_lab\.py/);
 assert.match(workflow,/needs: android-api28-same-process/);
 assert.match(workflow,/verify_guardiao_api28_two_cycle_receipts\.py same-process-review/);
 assert.match(workflow,/guardiao-api28-same-process-metadata-unreviewed/);
 assert.match(workflow,/path: same-process-receipts\//);
 assert.match(workflow,/retention-days: 2/);
 assert.doesNotMatch(workflow,/workflow_dispatch|assembleRelease|eas update|upload-apk|signingConfig|secrets\./i);
 assert.doesNotMatch(workflow,/path:\s*[^\n]*(?:\.apk|\.pdf|logcat|screenshots?)/i);
 assert.match(script,/base\.EXPECTED_SHA != receipt\.APK_SHA/);
 assert.match(script,/replay\.FIXTURE != "8" \+ "0" \* 47/);
 assert.match(script,/re\.fullmatch\(r"\[1-9\]\[0-9\]\{0,8\}", raw\)/);
 assert.match(script,/if args == \("install", "-r", str\(base\.APK\)\):/);
 assert.match(script,/if skipped or observed_single_app_pid\(\) != baseline_pid:/);
 assert.match(script,/base\.adb = keep_installed_app[\s\S]*finally:\s*\n\s*base\.adb = real_adb/);
 assert.match(script,/if not skipped or observed_single_app_pid\(\) != baseline_pid:/);
 assert.match(script,/semantic\.observed = None/);
 assert.match(script,/receipt\.verify\(parsed, 28\)/);
 assert.match(script,/semantic\.REPORT\.replace\(folder \/ receipt\.MEMBER\)/);
 assert.doesNotMatch(script,/base\.adb\("shell", "pm", "clear"|base\.adb\("uninstall"|base\.adb\("shell", "am", "force-stop"/);
 assert.match(common,/adb\("install", "-r", str\(APK\)/);
});

test('same-process flow accepts exactly one APK installation and rejects changed/unknown PIDs',()=>{
 const code=[
  'import os,sys,tempfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_original_release_same_process_lab as x',
  'with tempfile.TemporaryDirectory() as tmp:',
  '  os.chdir(tmp)',
  '  x.OUT=Path("same-process-receipts")',
  '  x.semantic.REPORT=Path("receipt.json")',
  '  calls=[]',
  '  pid=["321"]',
  '  def adb(*args,**kwargs):',
  '    calls.append(tuple(args))',
  '    if args[:2]==("shell","pidof"): return pid[0]',
  '    return ""',
  '  observed_home=[0]',
  '  def wait_visible(needle,**kw):',
  '    if needle=="Seu universo":',
  '      observed_home[0]+=1',
  '      if observed_home[0]==2: assert ("home-restored",) in calls',
  '    return {}',
  '  x.base.wait_visible=wait_visible',
  '  x.restore_home_tab_in_same_process=lambda expected: calls.append(("home-restored",))',
  '  def replay():',
  '    x.base.adb("install","-r",str(x.base.APK))',
  '    x.base.wait_visible("Seu universo")',
  '    x.semantic.REPORT.write_text("{}")',
  '  x.base.adb=adb',
  '  x.replay.run=replay',
  '  x.receipt.read_receipt=lambda path: {}',
  '  x.receipt.verify=lambda evidence,api: None',
  '  x.run()',
  '  assert sum(1 for call in calls if call[:2]==("install","-r"))==1,calls',
  '  assert (x.OUT/"cycle-a"/x.receipt.MEMBER).is_file()',
  '  assert (x.OUT/"cycle-b"/x.receipt.MEMBER).is_file()',
  '  x.OUT=Path("changed-pid")',
  '  calls=[]',
  '  pid=["321"]',
  '  counter=[0]',
  '  def changed(*args,**kwargs):',
  '    calls.append(tuple(args))',
  '    if args[:2]==("shell","pidof"):',
  '      counter[0]+=1',
  '      return "321" if counter[0]==1 else "654"',
  '    return ""',
  '  x.base.adb=changed',
  '  try: x.run()',
  '  except RuntimeError as e: assert str(e)=="same-process pre-replay identity unconfirmed"',
  '  else: raise AssertionError("PID changed without BLOCK")',
  '  assert not (x.OUT/"cycle-b").exists()',
  '  x.OUT=Path("unknown-pid")',
  '  x.base.adb=lambda *args,**kwargs: ""',
  '  try: x.run()',
  '  except RuntimeError as e: assert str(e)=="same-process baseline not confirmed"',
  '  else: raise AssertionError("unknown PID allowed")',
  '  assert not (x.OUT/"cycle-a").exists()',
  '  assert x.observed_single_app_pid() is None',
  '  assert x.observed_single_app_pid.__name__=="observed_single_app_pid"',
  'print("PASS: same-process synthetic PID and receipt gates")'
 ].join('\n');
 const run=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:15000});
 assert.equal(run.status,0,run.stderr);
 assert.match(run.stdout,/PASS: same-process synthetic PID and receipt gates/);
});

test('home recovery needs exact accessible tab, safe lower bound, home banner and unchanged process',()=>{
 const code=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_original_release_same_process_lab as x',
  'calls=[]',
  'x.base.screen_size=lambda: (1080,960)',
  'tab={"text":"Início","class":"android.widget.TextView","enabled":"true","bounds":"[100,850][170,900]"}',
  'x.base.xml_nodes=lambda: [tab]',
  'x.base.lookup=lambda needle: {"text":"Seu dinheiro."} if needle=="Seu dinheiro." else None',
  'x.base.scroll_backward=lambda: calls.append(("scroll",))',
  'x.base.adb=lambda *args,**kw: calls.append(tuple(args)) or ""',
  'x.observed_single_app_pid=lambda: "321"',
  'x.restore_home_tab_in_same_process("321")',
  'assert calls==[("shell","input","tap","135","875")],calls',
  'calls.clear()',
  'x.base.xml_nodes=lambda: [tab,tab]',
  'try: x.restore_home_tab_in_same_process("321")',
  'except RuntimeError as e: assert str(e)=="same-process exact home tab unavailable"',
  'else: raise AssertionError("duplicate tab accepted")',
  'assert not calls',
  'x.base.xml_nodes=lambda: [dict(tab,bounds="[100,50][170,100]")]',
  'try: x.restore_home_tab_in_same_process("321")',
  'except RuntimeError as e: assert str(e)=="same-process home tab outside bounded bottom bar"',
  'else: raise AssertionError("out-of-bounds tap accepted")',
  'assert calls==[("shell","dumpsys","input_method"),("shell","dumpsys","window","windows"),("shell","wm","size")],calls',
  'calls.clear()',
  'x.base.xml_nodes=lambda: [tab]',
  'x.base.lookup=lambda needle: None',
  'try: x.restore_home_tab_in_same_process("321")',
  'except RuntimeError as e: assert str(e)=="same-process home-only banner not observed"',
  'else: raise AssertionError("unverified home accepted")',
  'assert calls.count(("scroll",))==8',
  'calls.clear()',
  'x.observed_single_app_pid=lambda: "654"',
  'try: x.restore_home_tab_in_same_process("321")',
  'except RuntimeError as e: assert str(e)=="same-process home-navigation PID unconfirmed"',
  'else: raise AssertionError("changed PID accepted")',
  'assert not calls',
  'print("PASS: safe home navigation verified")'
 ].join('\n');
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS: safe home navigation verified/);
});

test('second cycle requires home navigation before searching for Guardiao',()=>{
 assert.match(script,/if needle == "Seu universo" and not home_gate_done:/);
 assert.match(script,/restore_home_tab_in_same_process\(baseline_pid\)/);
 const gate=script.indexOf('if needle == "Seu universo" and not home_gate_done:');
 const restore=script.indexOf('restore_home_tab_in_same_process(baseline_pid)',gate);
 const wait=script.indexOf('return original_wait_visible(',gate);
 assert.ok(gate>=0&&restore>gate&&wait>restore,'home gate must precede the home-only wait');
 assert.match(script,/if not home_gate_done:/);
 assert.match(script,/n\.get\("text"\) == "Início"/);
 assert.match(script,/base\.lookup\("Seu dinheiro\."\)/);
 assert.match(script,/base\.adb = keep_installed_app[\s\S]+base\.wait_visible = wait_with_home_gate/);
 assert.match(script,/finally:\s*\n\s*base\.adb = real_adb\s*\n\s*base\.wait_visible = original_wait_visible/);
 assert.doesNotMatch(script,/base\.adb\("shell", "pm", "clear"|base\.adb\("uninstall"|base\.adb\("shell", "am", "force-stop"/);
});


test('safe home block categories never contain native error details, data or UI XML',()=>{
 const py=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_original_release_same_process_lab as m',
  'expected={',
  ' "same-process home-navigation PID unconfirmed":"pid-before-home-unconfirmed",',
  ' "same-process exact home tab unavailable":"tab-absent-or-ambiguous",',
  ' "same-process home tab label type unconfirmed":"tab-label-other-class",',
  ' "same-process home tab bounds unavailable":"tab-bounds-unconfirmed",',
  ' "same-process home tab outside bounded bottom bar":"tab-outside-bottom-bar",',
  ' "same-process home-navigation PID changed":"pid-after-home-changed",',
  ' "same-process home-only banner not observed":"home-banner-unconfirmed"}',
  'for message,code in expected.items():',
  ' assert m.safe_home_block_category(RuntimeError(message)) == code',
  ' assert "same-process" not in code',
  'assert m.safe_home_block_category(RuntimeError("sensitive screen text")) == "other-or-unconfirmed"',
  'assert m.safe_home_block_category(ValueError("raw emulator dump")) == "other-or-unconfirmed"',
  'assert m.safe_home_block_category(Exception("secret")) == "other-or-unconfirmed"',
  'print("PASS: native and private errors cannot enter public home category")'
 ].join('\n');
 const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: native and private errors cannot enter public home category/);
});

test('same-process navigation diagnostics disclose stage only and never native error strings',()=>{
 assert.match(script,/HOME_BLOCK_CODES = \{/);
 assert.match(script,/safe_home_block_category\(error\)/);
 assert.match(script,/if n\.get\("text"\) == "Início" or n\.get\("content-desc"\) == "Início"/);
 assert.match(script,/other_class_label_seen = True/);
 assert.match(script,/STAGE \(LAB\): same-process unique home tab verified/);
 assert.match(script,/STAGE \(LAB\): same-process home tab target bounded/);
 assert.match(script,/BLOCK STAGE \(LAB\): same-process home return/);
 assert.doesNotMatch(script,/print\([^\n]*(?:str\(error\)|repr\(error\)|traceback|\\.message|\\.stack)/i);
});
