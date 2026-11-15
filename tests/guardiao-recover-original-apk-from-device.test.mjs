import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_recover_original_apk_from_device.py','utf8');

test('ADB recovery reads only one package code path, requires original pinned hash, never installs or reads financial data',()=>{
 assert.match(runner,/PACKAGE = "com.negresco.finance"/);
 assert.match(runner,/classify_installed_code_path/);
 assert.match(runner,/CODE_PATH_PATTERN\.fullmatch\(path\)/);
 assert.match(runner,/if len\(lines\) != 1/);
 assert.match(runner,/\["adb", "-s", serial, "shell", "pm", "path", PACKAGE\]/);
 assert.match(runner,/\["adb", "-s", serial, "pull", installed_path, str\(ephemeral\)\]/);
 assert.match(runner,/identity_check=verify\.classify_candidate/);
 assert.match(runner,/if status != PASS_CODE:/);
 assert.match(runner,/if identity_check\(output\) != PASS_CODE:/);
 assert.match(runner,/os\.O_EXCL/);
 assert.match(runner,/output\.unlink\(missing_ok=True\)/);
 assert.match(runner,/tempfile\.TemporaryDirectory/);
 assert.match(runner,/stdin=subprocess\.DEVNULL, capture_output=True, text=True/);
 assert.doesNotMatch(runner,/subprocess\.(?:Popen|call)|shell=True|adb\s+install|am\s+force-stop|pm\s+clear|run-as|adb\s+backup|\/data\/data\/|\/sdcard\/|android\.permission|write_bytes\(.*raw|print\(result\.stdout\)|print\(serial\)/i);
});

test('ADB installed package parser and backup gates reject splits, fake original, symlinks and existing backup',()=>{
 const py=[
  'import tempfile,sys',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_recover_original_apk_from_device as x',
  'valid="package:/data/app/~~abc/com.negresco.finance-xyz==/base.apk"',
  'assert x.classify_installed_code_path(valid)[0]=="device-apk-single-code-path-confirmed"',
  'for raw in ("",valid+"\\n"+valid,"package:/data/user/0/private/base.apk","package:/data/app/../base.apk","package:/sdcard/base.apk"):',
  ' assert x.classify_installed_code_path(raw)[0]!="device-apk-single-code-path-confirmed"',
  'with tempfile.TemporaryDirectory() as d:',
  ' dest=Path(d)/"original.apk"; calls=[]',
  ' def adb(args,*,timeout):',
  '  calls.append(args)',
  '  if "pm" in args:',
  '   return type("Result",(),{"returncode":0,"stdout":valid})()',
  '  assert args[3]=="pull"',
  '  Path(args[-1]).write_bytes(b"synthetic package code only")',
  '  return type("Result",(),{"returncode":0,"stdout":"suppressed"})()',
  ' identity=lambda p:x.PASS_CODE',
  ' assert x.recover_original_apk("emulator-5554",dest,command=adb,identity_check=identity)=="exact-original-apk-recovered-to-user-selected-path"',
  ' assert dest.read_bytes()==b"synthetic package code only"',
  ' assert sum("pull" in c for c in calls)==1',
  ' assert x.recover_original_apk("emulator-5554",dest,command=adb,identity_check=identity)=="destination-must-be-new-apk"',
  ' bad=Path(d)/"bad.apk"',
  ' assert x.recover_original_apk("emulator-5554",bad,command=adb)=="installed-app-is-not-exact-original"',
  ' assert not bad.exists()',
  ' assert x.recover_original_apk("-bad",Path(d)/"invalid.apk",command=adb)=="device-serial-unconfirmed"',
  ' assert len(calls)==4',
  ' print("PASS: one read-only ADB pull, no false original or overwritten backup")'
 ].join('\n');
 const p=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: one read-only ADB pull/);
});
