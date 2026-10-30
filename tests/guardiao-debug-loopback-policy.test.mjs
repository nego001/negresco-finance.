import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const source=readFileSync('tooling/android/guardiao_debug_loopback_policy.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-android-debug-metro-phase-lab.yml','utf8');
const release=readFileSync('apps/mobile/plugins/withNegrescoNetworkPolicy.js','utf8');
const helper=`
import sys
from pathlib import Path
sys.path.insert(0,"tooling/android")
from guardiao_debug_loopback_policy import install, RELEASE_XML, DEBUG_XML, HOSTS
root=Path(sys.argv[1])
main=root/"src/main/res/xml/negresco_network_security.xml"
main.parent.mkdir(parents=True)
main.write_text(RELEASE_XML, encoding="utf-8")
install(root)
install(root)
assert main.read_text()=="<?xml version=\\"1.0\\" encoding=\\"utf-8\\"?>\\n"+RELEASE_XML.split("\\n",1)[1]
debug=root/"src/debug/res/xml/negresco_network_security.xml"
assert debug.read_text()==DEBUG_XML
assert tuple(HOSTS)==("localhost","127.0.0.1","10.0.2.2")
print("PASS: isolated Debug resource is exact and idempotent")
`;

test('Only a disposable Debug XML resource receives three loopback cleartext exceptions',()=>{
 const root=mkdtempSync(join(tmpdir(),'negresco-loopback-test-'));
 try {
  const r=spawnSync('python3',['-c',helper,root],{encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.stdout.trim(),'PASS: isolated Debug resource is exact and idempotent');
 } finally {rmSync(root,{recursive:true,force:true});}
});

test('Network policy source and workflow keep the release fail-closed',()=>{
 assert.match(release,/cleartextTrafficPermitted=\\"false\\"/);
 assert.match(release,/android:usesCleartextTraffic.*false/);
 assert.match(source,/base-config cleartextTrafficPermitted="false"/);
 assert.match(source,/domain-config cleartextTrafficPermitted="true"/);
 for (const host of ['localhost','127.0.0.1','10.0.2.2']) assert.ok(source.includes(host));
 assert.match(workflow,/python3 tooling\/android\/guardiao_debug_loopback_policy\.py install/);
 assert.match(workflow,/python3 tooling\/android\/guardiao_debug_loopback_policy\.py verify-apk "\\$APK" "\\$ANDROID_HOME\/build-tools\/35\.0\.0\/aapt"/);
 const prebuild=workflow.indexOf('npx expo prebuild');
 const overlay=workflow.indexOf('python3 tooling/android/guardiao_debug_loopback_policy.py install');
 const compile=workflow.indexOf('./gradlew :app:assembleDebug');
 const audit=workflow.indexOf('python3 tooling/android/guardiao_debug_loopback_policy.py verify-apk');
 assert.ok(prebuild>=0 && prebuild<overlay && overlay<compile && compile<audit);
 assert.match(workflow,/for denied in android\.permission\.SYSTEM_ALERT_WINDOW/);
 assert.doesNotMatch(workflow,/assembleRelease|contents: write|secrets\.|upload-artifact|eas update|expo publish/);
});

test('Packaged APK policy inspection checks compiled resource and rejects nonlocal cleartext',()=>{
 assert.match(source,/aapt, "dump", "xmltree"/);
 assert.match(source,/len\(re\.findall\(r"E: domain/);
 assert.match(source,/\[value\(a\) for a in attrs\] != \[False, True\]/);
 assert.match(source,/len\(attrs\) != 2/);
 assert.doesNotMatch(source,/print\(.*proc\.stdout|print\(.*xmltree|logcat|screencap|urllib/i);
});
