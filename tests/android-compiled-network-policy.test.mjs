import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync, chmodSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const verifier=fileURLToPath(new URL('../tooling/android/verify_compiled_network_policy.py',import.meta.url));
const apkPath='res/xml/secured_a1.xml';
const resourceId='0x7f150003';
const manifest=[
  'N: android=http://schemas.android.com/apk/res/android',
  'E: manifest (line=1)',
  '  E: application (line=5)',
  '    A: android:networkSecurityConfig(0x01010527)=@0x7f150003',
  '    A: android:usesCleartextTraffic(0x010104ec)=(type 0x12)0x0',
  '    E: activity (line=10)'
].join('\n')+'\n';
const resources=[
  'Package Group 0 id=0x7f packageCount=1 name=com.negresco.finance',
  '  resource 0x7f150003 com.negresco.finance:xml/negresco_network_security',
  '    () (file) res/xml/secured_a1.xml type=XML'
].join('\n')+'\n';
const policy=[
  'E: network-security-config (line=2)',
  '  E: base-config (line=3)',
  '    A: cleartextTrafficPermitted(0x01010600)=(type 0x12)0x0',
  '    E: trust-anchors (line=4)',
  '      E: certificates (line=5)',
  '        A: src(0x01010700)="system" (Raw: "system")'
].join('\n')+'\n';

function check(t,options={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-network-compiled-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const apk=join(dir,'candidate.apk'),aapt2=join(dir,'aapt2');
  const python=[
    'import sys,zipfile',
    "with zipfile.ZipFile(sys.argv[1],'w') as z:",
    " for i in range(int(sys.argv[3])): z.writestr(sys.argv[2],b'compiled-xml')"
  ].join('\n');
  const pack=spawnSync('python3',['-c',python,apk,options.path??apkPath,options.duplicateMember?'2':'1'],{encoding:'utf8'});
  assert.equal(pack.status,0,pack.stderr);
  const mock=[
    '#!/usr/bin/env python3',
    'import os,sys',
    "if sys.argv[1:3]==['dump','resources']:",
    " print(os.environ.get('FAKE_RESOURCES',''))",
    "elif sys.argv[1:3]==['dump','xmltree']:",
    " if sys.argv[4:] == ['--file','AndroidManifest.xml']:",
    "  print(os.environ.get('FAKE_MANIFEST',''))",
    ' else:',
    "  if os.environ.get('FAKE_AAPT2_FAIL')=='yes': sys.exit(67)",
    "  print(os.environ.get('FAKE_POLICY',''))",
    'else: sys.exit(68)'
  ].join('\n')+'\n';
  writeFileSync(aapt2,mock);chmodSync(aapt2,0o755);
  return spawnSync('python3',[verifier,apk,aapt2],{
    cwd:dir,encoding:'utf8',timeout:10000,
    env:{...process.env,FAKE_RESOURCES:options.resources??resources,
      FAKE_MANIFEST:options.manifest??manifest,FAKE_POLICY:options.policy??policy,
      FAKE_AAPT2_FAIL:options.failDump?'yes':'no'}
  });
}

test('compiled network XML linked by APK resource ID enforces HTTPS/system CA',t=>{
  const result=check(t);
  assert.equal(result.status,0,result.stderr+result.stdout);
  assert.match(result.stdout,/PASS: packaged network security XML forbids cleartext/);
});

test('AAPT2 SDK formatting can align attributes with owning nodes without weakening XML semantics',t=>{
  for(const altered of [
    policy.replace('    A: cleartextTrafficPermitted','  A: cleartextTrafficPermitted'),
    policy.replace('        A: src','      A: src'),
    policy.replace('    A: cleartextTrafficPermitted','  A: cleartextTrafficPermitted')
          .replace('        A: src','      A: src')
  ]) {
    const result=check(t,{policy:altered});
    assert.equal(result.status,0,result.stderr+result.stdout);
  }
});

for(const [scenario,xml,expected] of [
  ['cleartext flag moved to root before base-config',
    policy.replace('    A: cleartextTrafficPermitted(0x01010600)=(type 0x12)0x0\n','')
      .replace('  E: base-config','  A: cleartextTrafficPermitted(0x01010600)=(type 0x12)0x0\n  E: base-config'),
    /cleartext attribute not nested under base-config/],
  ['cleartext flag moved to trust-anchors child',
    policy.replace('    A: cleartextTrafficPermitted(0x01010600)=(type 0x12)0x0\n','')
      .replace('    E: trust-anchors (line=4)','    E: trust-anchors (line=4)\n      A: cleartextTrafficPermitted(0x01010600)=(type 0x12)0x0'),
    /cleartext attribute not nested under base-config/],
  ['certificate source set on parent trust anchors',
    policy.replace('        A: src(0x01010700)="system" (Raw: "system")\n','')
      .replace('      E: certificates (line=5)','      A: src(0x01010700)="system" (Raw: "system")\n      E: certificates (line=5)'),
    /certificate source must belong to certificates element/]
]){
  test('compiled policy rejects wrong attribute owner: '+scenario,t=>{
    const result=check(t,{policy:xml});
    assert.notEqual(result.status,0,scenario);
    assert.match(result.stderr+result.stdout,expected);
  });
}

test('aapt2 bare system certificate value remains trusted without accepting user anchors',t=>{
  for(const trusted of ['system','"system"']) {
    const safe=policy.replace('"system" (Raw: "system")',trusted);
    const result=check(t,{policy:safe});
    assert.equal(result.status,0,trusted+'\n'+result.stderr);
  }
  for(const untrusted of ['user','"user"','system (Raw: "user")','system user']) {
    const bad=policy.replace('"system" (Raw: "system")',untrusted);
    const result=check(t,{policy:bad});
    assert.notEqual(result.status,0,untrusted);
    assert.match(result.stderr,/certificate source must be system only/);
  }
});


test('aapt2 may preserve an unnamespaced false attribute as a string without weakening policy',t=>{
  for(const safeValue of [
    '"false" (Raw: "false")',
    '"false"',
    'false',
    '(type 0x03)0x00000005 (Raw: "false")'
  ]){
    const variant=policy.replace('(type 0x12)0x0',safeValue);
    const result=check(t,{policy:variant});
    assert.equal(result.status,0,safeValue+'\n'+result.stderr+result.stdout);
  }
});

for(const unsafeValue of [
  '"true" (Raw: "true")',
  '"false" (Raw: "true")',
  '"FALSE" (Raw: "FALSE")',
  '" false " (Raw: " false ")',
  '(type 0x03)0x00000005 (Raw: "true")',
  '(type 0x12)0x1',
  '(type 0x12)0xffffffff',
  '(type 0x10)0x0',
  'FALSE',
  'false ',
  ' false',
  '"false" (Raw: "false") unexpected'
]){
  test('compiled network policy rejects unsafe/unrecognized HTTP value: '+unsafeValue,t=>{
    const result=check(t,{policy:policy.replace('(type 0x12)0x0',unsafeValue)});
    assert.notEqual(result.status,0,unsafeValue);
    assert.match(result.stderr,/cleartextTrafficPermitted must be explicitly false/);
  });
}


for(const [label,opts,reason] of [
  ['different manifest resource ID',{manifest:manifest.replace(resourceId,'0x7f150099')},/resource ID is missing/],
  ['different network resource name',{resources:resources.replace('xml/negresco_network_security','xml/unexpected')},/unexpected XML resource/],
  ['duplicate resource ID',{resources:resources+resources},/resource ID is missing or ambiguous/],
  ['no XML resource path',{resources:resources.replace(apkPath,'unknown')},/exactly one packaged XML path/],
  ['APK lacks compiled XML',{path:'res/xml/unrelated.xml'},/compiled network XML missing/],
  ['APK duplicates compiled XML',{duplicateMember:true},/compiled network XML missing or duplicated/],
  ['HTTP enabled in XML',{policy:policy.replace('=(type 0x12)0x0','=(type 0x12)0xffffffff')},/cleartextTrafficPermitted/],
  ['missing cleartext flag',{policy:policy.split('\n').filter(x=>!x.includes('cleartextTrafficPermitted')).join('\n')},/two attributes/],
  ['user-installed CA trusted',{policy:policy.replaceAll('"system"','"user"')},/system only/],
  ['debug overrides introduced',{policy:policy+'  E: debug-overrides (line=7)\n'},/unexpected XML elements/],
  ['domain exception introduced',{policy:policy+'  E: domain-config (line=8)\n'},/unexpected XML elements/],
  ['additional certificate source',{policy:policy+'        A: src(0x01010700)="user" (Raw: "user")\n'},/two attributes/],
  ['missing trust anchors',{policy:policy.replace('E: trust-anchors','E: other-trust-anchors')},/unexpected XML elements/],
  ['malformed manifest resource',{manifest:manifest.replace('@0x7f150003','"@xml/negresco_network_security"')},/invalid compiled networkSecurityConfig/],
  ['aapt2 cannot inspect XML',{failDump:true},/aapt2 xmltree failed/]
]){
  test('compiled network policy blocks: '+label,t=>{
    const result=check(t,opts);
    assert.notEqual(result.status,0,label);
    assert.match(result.stderr+result.stdout,reason);
  });
}

test('APK build refuses to upload when compiled network XML audit fails',()=>{
  const wf=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
  const build=wf.slice(wf.indexOf('  build-test-apk:'),wf.indexOf('  publish-test-prerelease:'));
  const verify=build.indexOf('verify_compiled_network_policy.py "$APK" "$BUILD_TOOLS/aapt2"');
  const upload=build.indexOf('uses: actions/upload-artifact@v4');
  assert.ok(verify>0&&upload>verify);
  assert.match(build,/test -x "\$BUILD_TOOLS\/aapt2"/);
  assert.match(wf,/tests\/android-compiled-network-policy\.test\.mjs/);
  assert.doesNotMatch(wf.slice(wf.indexOf('  publish-test-prerelease:')),/actions\/checkout/);
});
