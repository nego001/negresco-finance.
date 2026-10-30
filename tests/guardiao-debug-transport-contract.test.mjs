import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const smoke=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');
const py=`
import sys
sys.path.insert(0,"tooling/android")
import guardiao_pdf_debug_metro_lab as p
def reachable(*args,**kwargs):
  if args[:2]==("reverse","--list"): return "emulator-5554 tcp:8081 tcp:8081"
  if args[:3]==("shell","sh","-c"): return "HTTP/1.0 200 OK\\r\\n\\r\\npackager-status:running"
  raise AssertionError("unapproved adb command")
p.base.adb=reachable
assert p.probe_android_local_metro()=="device-local-metro-reachable"
def missing(*args,**kwargs): return ""
p.base.adb=missing
assert p.probe_android_local_metro()=="adb-reverse-not-confirmed"
def unavailable(*args,**kwargs):
  if args[:2]==("reverse","--list"): return "tcp:8081 tcp:8081"
  raise RuntimeError("synthetic unsupported network tool")
p.base.adb=unavailable
assert p.probe_android_local_metro()=="device-status-probe-unavailable"
def invalid(*args,**kwargs):
  if args[:2]==("reverse","--list"): return "tcp:8081 tcp:8081"
  return "HTTP/1.0 503 unavailable"
p.base.adb=invalid
assert p.probe_android_local_metro()=="device-status-probe-unconfirmed"
print("PASS: fixed Android loopback categories")
`;

test('Android network transport classifications use synthetic data and fail closed',()=>{
 const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: fixed Android loopback categories');
});
test('transport probe is local-only, read-only and has fixed-before/after categories',()=>{
 assert.match(runner,/def probe_android_local_metro\(\) -> str:/);
 assert.match(runner,/base\.adb\("reverse", "--list", timeout=15, check=False\)/);
 assert.match(runner,/packager-status:running/);
 assert.match(runner,/toybox nc -w 4 127\.0\.0\.1/);
 assert.match(runner,/report_android_local_metro\("before-app"\)/);
 assert.match(runner,/report_android_local_metro\("after-app-failure"\)/);
 assert.match(runner,/stage not in \("before-app", "after-app-failure"\)/);
 assert.match(smoke,/adb\("shell", "svc", "wifi", "disable", check=False\)/);
 assert.match(smoke,/adb\("shell", "svc", "data", "disable", check=False\)/);
 const section=runner.slice(runner.indexOf('def probe_android_local_metro()'),runner.indexOf('def run() -> None:'));
 assert.doesNotMatch(section,/https?:\/\/|logcat|screencap|print\(.*raw|print\(.*routes|input\(|open\(|write\(|delete\(/i);
});
