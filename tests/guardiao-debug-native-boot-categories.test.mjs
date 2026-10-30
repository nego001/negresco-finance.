import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const native=readFileSync('tooling/android/guardiao_debug_native_boot_categories.py','utf8');
const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const verify=`
import sys
sys.path.insert(0,"tooling/android")
from guardiao_debug_native_boot_categories import classify_native_startup, classify_permissions
samples=(
 ("Cleartext HTTP traffic not permitted", "native-cleartext-denied"),
 ("SecurityException android.permission.INTERNET Permission Denial", "native-internet-permission-denied"),
 ("java.net.UnknownHostException", "native-dns-unreachable"),
 ("java.net.ConnectException: Failed to connect: ECONNREFUSED", "native-connection-refused"),
 ("java.net.SocketTimeoutException", "native-connection-timeout"),
 ("Unable to load script", "native-js-bundle-load-error"),
 ("ReactNativeJS TypeError: undefined is not an object", "native-js-runtime-error"),
 ("private invoice 9999999999999", "native-startup-unconfirmed"),
)
for record, category in samples:
    assert classify_native_startup(record)==category
assert classify_native_startup("X"*120001)=="native-startup-unconfirmed"
assert classify_permissions("android.permission.INTERNET: granted=true")=="internet-permission-granted"
assert classify_permissions("android.permission.INTERNET: granted=false")=="internet-permission-not-granted"
assert classify_permissions("unrelated")=="internet-permission-not-declared"
print("PASS: synthetic native boot and permission categories")
`;

test('native Android boot classifier only emits fixed categories on synthetic samples',()=>{
 const r=spawnSync('python3',['-c',verify],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: synthetic native boot and permission categories');
});
test('only bounded native system tags are inspected, and raw logs are never printed or stored',()=>{
 assert.match(native,/MAX_NATIVE_OUTPUT = 120_000/);
 assert.match(native,/\["logcat", "-d", "-t", "240", "-s"/);
 assert.match(native,/\["shell", "dumpsys", "package", APP_PACKAGE\]/);
 assert.match(native,/return perm_category, boot_category/);
 assert.match(runner,/native_diagnosis\.collect_categories\(\)/);
 assert.doesNotMatch(native,/print\(|logging\.|write_text|open\(|https?:\/\/|screencap|upload_file|requests\.|urllib/i);
 assert.doesNotMatch(runner,/logcat|screencap|print\(.*(?:html|uri|xml|exception|digest|FIXTURE)/i);
});
