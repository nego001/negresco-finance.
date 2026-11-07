import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('tooling/android/guardiao_debug_metro_app_process_probe.py','utf8');
const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');

const synthetic=[
"import sys",
"sys.path.insert(0,'tooling/android')",
"import guardiao_debug_metro_app_process_probe as p",
"assert p.classify_result('LOOPBACK=REACHABLE;ALIAS=UNCONFIRMED')==('shell-metro-status-reachable','shell-route-unconfirmed')",
"assert p.classify_result('LOOPBACK=UNCONFIRMED;ALIAS=REACHABLE')==('shell-route-unconfirmed','shell-metro-status-reachable')",
"for value in (None,'','LOOPBACK=REACHABLE;ALIAS=TOKEN','LOOPBACK=REACHABLE;ALIAS=REACHABLE;OTHER=1','OTHER=REACHABLE;ALIAS=REACHABLE','x'*513):",
"    assert p.classify_result(value)==p.UNAVAILABLE",
"assert p.classify_result('LOOPBACK=UNCONFIRMED;ALIAS=UNCONFIRMED')==p.UNCONFIRMED",
"assert p.CLASS_NAME=='com.negresco.lab.MetroRouteProbe'",
"assert p.DESTINATION.startswith('/data/local/tmp/')",
"assert 'GET /status HTTP/1.0' in p.JAVA_SOURCE",
"assert 'System.out.println(\"LOOPBACK=\"' in p.JAVA_SOURCE",
"assert 'android.permission.INTERNET' not in p.JAVA_SOURCE",
"assert '10.0.2.2' in p.JAVA_SOURCE",
"assert '127.0.0.1' in p.JAVA_SOURCE",
"print('PASS: fixed Android shell-UID Metro probe classification')",
].join('\n');

test('Java probe converts only synthetic allowlisted output to two categories',()=>{
 const r=spawnSync('python3',['-c',synthetic],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: fixed Android shell-UID Metro probe classification');
});

test('probe uses two fixed local hosts and cleans ephemeral Android dex',()=>{
 assert.match(source,/JAVA_SOURCE = r"""/);
 assert.match(source,/connection\.connect\(new InetSocketAddress\(host, PORT\), 3000\)/);
 assert.match(source,/if \(!host\.equals\("127\.0\.0\.1"\) && !host\.equals\("10\.0\.2\.2"\)\)/);
 assert.match(source,/MAX_BYTES = 8192/);
 assert.match(source,/MAX_RESULT = 512/);
 assert.match(source,/--min-api", "28"/);
 assert.match(source,/app_process \/system\/bin/);
 assert.match(source,/finally:[\s\S]*?\["adb", "shell", "rm", "-f", DESTINATION\]/);
 assert.match(runner,/before-radio-disable shell loopback/);
 assert.match(runner,/before-radio-disable shell emulator alias/);
 assert.match(runner,/relay\.reset_after_preflight\(\)/);
 assert.match(runner,/shell_route_probe\.probe_shell_routes\(\)/);
 assert.match(runner,/Android Debug shell emulator alias/);
 assert.doesNotMatch(source,/logcat|screencap|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|upload_file|https?:\/\/|eas update|adb.*root|adb.*remount|sh -c.*curl/i);
 assert.doesNotMatch(runner,/print\(.*shell_route_probe\.JAVA_SOURCE/);
});
