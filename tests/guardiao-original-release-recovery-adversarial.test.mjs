import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('tooling/android/guardiao_recover_original_apk_from_device.py','utf8');
const verify=readFileSync('tooling/android/guardiao_verify_original_apk_offline.py','utf8');

function runPython(body){
 const result=spawnSync('python3',['-c',[
  'import os, pathlib, stat, sys, tempfile',
  'from types import SimpleNamespace',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_recover_original_apk_from_device as r',
  'import guardiao_verify_original_apk_offline as v',
  body,
 ].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr || result.stdout);
 assert.match(result.stdout,/PASS \(LAB\): offline original recovery adversarial fixture/);
 assert.doesNotMatch(result.stdout,/PRIVATE|SECRET|\/data\/app\/|TEST-SERIAL/);
}

test('only one narrowly scoped /data/app base APK path is accepted; split, traversal and private paths denied',()=>{
 runPython([
  "good='package:/data/app/~~hash/com.negresco.finance-aa/base.apk'",
  "assert r.classify_installed_code_path(good)==('device-apk-single-code-path-confirmed','/data/app/~~hash/com.negresco.finance-aa/base.apk')",
  "for bad in ['',good+'\\n'+good,'package:/data/data/com.negresco.finance/files/secret','package:/sdcard/Download/other.apk','package:/data/app/../base.apk','package:/data/app/~~hash/com.negresco.finance-aa/split_config.apk','private data','package:/data/app/base.apk\\nnoise']:",
  '  assert r.classify_installed_code_path(bad)[1] is None',
  "assert r.classify_installed_code_path('x'*9000)[1] is None",
  "print('PASS (LAB): offline original recovery adversarial fixture')",
 ].join('\n'));
});

test('mock device recovery reads package code only; output uses private mode and independent second verification',()=>{
 runPython([
  "with tempfile.TemporaryDirectory() as td:",
  "  output=pathlib.Path(td)/'recovered.apk'",
  "  payload=b'PRIVATE-SYNTHETIC-APK-CONTENT'",
  "  calls=[]; inspected=[]",
  "  def adb(argv,*,timeout):",
  "    calls.append((argv,timeout))",
  "    if argv[3:]==['shell','pm','path',r.PACKAGE]:",
  "      return SimpleNamespace(returncode=0,stdout='package:/data/app/~~hash/com.negresco.finance-aa/base.apk',stderr='SECRET')",
  "    if argv[3]=='pull':",
  "      pathlib.Path(argv[5]).write_bytes(payload)",
  "      return SimpleNamespace(returncode=0,stdout='SECRET',stderr='SECRET')",
  "    raise AssertionError('unexpected command')",
  "  def check(path):",
  "    inspected.append(path)",
  "    return r.PASS_CODE if path.read_bytes()==payload else 'original-apk-sha256-mismatch'",
  "  status=r.recover_original_apk('TEST-SERIAL',output,command=adb,identity_check=check)",
  "  assert status=='exact-original-apk-recovered-to-user-selected-path'",
  "  assert output.read_bytes()==payload",
  "  assert stat.S_IMODE(output.stat().st_mode)==0o600",
  "  assert len(inspected)==2 and inspected[0]!=output and inspected[1]==output",
  "  assert len(calls)==2",
  "  assert calls[0][0]==['adb','-s','TEST-SERIAL','shell','pm','path',r.PACKAGE]",
  "  assert calls[1][0][:4]==['adb','-s','TEST-SERIAL','pull']",
  "  assert calls[1][0][4]=='/data/app/~~hash/com.negresco.finance-aa/base.apk'",
  "  assert all('shell=True' not in str(x) for x in calls)",
  "print('PASS (LAB): offline original recovery adversarial fixture')",
 ].join('\n'));
});

test('failed first/second byte verification never leaves retained APK; existing target remains untouched',()=>{
 runPython([
  "with tempfile.TemporaryDirectory() as td:",
  "  root=pathlib.Path(td); payload=b'PRIVATE-SYNTHETIC'",
  "  def adb(argv,*,timeout):",
  "    if argv[3]=='shell': return SimpleNamespace(returncode=0,stdout='package:/data/app/x/base.apk')",
  "    if argv[3]=='pull': pathlib.Path(argv[5]).write_bytes(payload); return SimpleNamespace(returncode=0,stdout='PRIVATE')",
  "    raise AssertionError('not permitted')",
  "  out=root/'refuse.apk'",
  "  assert r.recover_original_apk('TEST-SERIAL',out,command=adb,identity_check=lambda path:'original-apk-sha256-mismatch')=='installed-app-is-not-exact-original'",
  "  assert not out.exists()",
  "  times=[0]",
  "  def check(path):",
  "    times[0]+=1",
  "    return r.PASS_CODE if times[0]==1 else 'original-apk-sha256-mismatch'",
  "  assert r.recover_original_apk('TEST-SERIAL',out,command=adb,identity_check=check)=='recovered-apk-copy-unconfirmed'",
  "  assert times[0]==2 and not out.exists()",
  "  out.write_bytes(b'USER FILE - DO NOT OVERWRITE')",
  "  assert r.recover_original_apk('TEST-SERIAL',out,command=adb,identity_check=lambda p:r.PASS_CODE)=='destination-must-be-new-apk'",
  "  assert out.read_bytes()==b'USER FILE - DO NOT OVERWRITE'",
  "print('PASS (LAB): offline original recovery adversarial fixture')",
 ].join('\n'));
});

test('malformed serial, split package and missing installation fail closed without adb pull',()=>{
 runPython([
  "with tempfile.TemporaryDirectory() as td:",
  "  dst=pathlib.Path(td)/'original.apk'",
  "  calls=[]",
  "  def adb(argv,*,timeout):",
  "    calls.append(argv)",
  "    return SimpleNamespace(returncode=0,stdout='package:/data/app/first/base.apk\\npackage:/data/app/first/split_config.apk')",
  "  assert r.recover_original_apk('BAD SERIAL',dst,command=adb)=='device-serial-unconfirmed'",
  "  assert calls==[]",
  "  assert r.recover_original_apk('TEST-SERIAL',dst,command=adb)=='device-apk-single-code-path-unconfirmed'",
  "  assert len(calls)==1 and calls[0][3]=='shell'",
  "  assert not dst.exists()",
  "  assert r.recover_original_apk('TEST-SERIAL',dst,command=lambda a,**k:SimpleNamespace(returncode=1,stdout='SECRET'))=='device-package-query-unavailable'",
  "  assert not dst.exists()",
  "print('PASS (LAB): offline original recovery adversarial fixture')",
 ].join('\n'));
});

test('production CLI fixes the real pinned digest and checks twice; no debugging leaks',()=>{
 assert.match(source,/identity_check=verify\.classify_candidate/);
 assert.match(source,/if status != PASS_CODE/);
 assert.match(source,/if identity_check\(output\) != PASS_CODE/);
 assert.match(source,/os\.O_EXCL/);
 assert.match(source,/os\.O_NOFOLLOW/);
 assert.match(source,/with tempfile\.TemporaryDirectory/);
 assert.match(source,/output\.unlink\(missing_ok=True\)/);
 assert.match(verify,/ORIGINAL_APK_SHA256 = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(verify,/hashlib\.sha256/);
 assert.doesNotMatch(source,/shell=True|subprocess\.Popen|adb logcat|screencap|pull", "\/data\/data|print\(result\.stdout|print\(pulled\.stderr/);
});
