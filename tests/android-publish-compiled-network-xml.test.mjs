import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync, chmodSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const start=workflow.indexOf('      - name: Independently audit downloaded compiled network XML');
const end=workflow.indexOf('      - name: Stage private draft and publish only after complete verified upload',start);
assert.ok(start>=0 && end>start);
const auditStep=workflow.slice(start,end);
const opener="          python3 - \"$BUILD_TOOLS/aapt2\" Negresco-Finance-V3.1.3-preview.apk <<'PY'\n";
const p0=auditStep.indexOf(opener),p1=auditStep.indexOf('\n          PY',p0);
assert.ok(p0>=0 && p1>p0);
const verifier=auditStep.slice(p0+opener.length,p1).split('\n')
  .map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
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
  return spawnSync('python3',['-c',verifier,aapt2,apk],{
    cwd:dir,encoding:'utf8',timeout:10000,
    env:{...process.env,FAKE_RESOURCES:options.resources??resources,
      FAKE_MANIFEST:options.manifest??manifest,FAKE_POLICY:options.policy??policy,
      FAKE_AAPT2_FAIL:options.failDump?'yes':'no'}
  });
}

test('compiled network XML linked by APK resource ID enforces HTTPS/system CA',t=>{
  const result=check(t);
  assert.equal(result.status,0,result.stderr+result.stdout);
  assert.match(result.stdout,/PASS: privileged downloaded APK compiled network policy forbids HTTP/);
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
    /cleartext attribute outside base-config/],
  ['cleartext flag moved to trust-anchors child',
    policy.replace('    A: cleartextTrafficPermitted(0x01010600)=(type 0x12)0x0\n','')
      .replace('    E: trust-anchors (line=4)','    E: trust-anchors (line=4)\n      A: cleartextTrafficPermitted(0x01010600)=(type 0x12)0x0'),
    /cleartext attribute outside base-config/],
  ['certificate source set on parent trust anchors',
    policy.replace('        A: src(0x01010700)="system" (Raw: "system")\n','')
      .replace('      E: certificates (line=5)','      A: src(0x01010700)="system" (Raw: "system")\n      E: certificates (line=5)'),
    /certificate source outside certificates element/]
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
    assert.match(result.stderr,/certificate authority other than system/);
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
    assert.match(result.stderr,/cleartextTrafficPermitted is not false/);
  });
}


for(const [label,opts,reason] of [
  ['different manifest resource ID',{manifest:manifest.replace(resourceId,'0x7f150099')},/policy resource ID missing/],
  ['different network resource name',{resources:resources.replace('xml/negresco_network_security','xml/unexpected')},/policy resource name differs/],
  ['duplicate resource ID',{resources:resources+resources},/policy resource ID missing or duplicated/],
  ['no XML resource path',{resources:resources.replace(apkPath,'unknown')},/resource path missing or ambiguous/],
  ['APK lacks compiled XML',{path:'res/xml/unrelated.xml'},/XML missing or duplicated in APK/],
  ['APK duplicates compiled XML',{duplicateMember:true},/XML missing or duplicated in APK/],
  ['HTTP enabled in XML',{policy:policy.replace('=(type 0x12)0x0','=(type 0x12)0xffffffff')},/cleartextTrafficPermitted/],
  ['missing cleartext flag',{policy:policy.split('\n').filter(x=>!x.includes('cleartextTrafficPermitted')).join('\n')},/cleartext and certificate attributes/],
  ['user-installed CA trusted',{policy:policy.replaceAll('"system"','"user"')},/certificate authority other than system/],
  ['debug overrides introduced',{policy:policy+'  E: debug-overrides (line=7)\n'},/unexpected elements or exceptions/],
  ['domain exception introduced',{policy:policy+'  E: domain-config (line=8)\n'},/unexpected elements or exceptions/],
  ['additional certificate source',{policy:policy+'        A: src(0x01010700)="user" (Raw: "user")\n'},/cleartext and certificate attributes/],
  ['missing trust anchors',{policy:policy.replace('E: trust-anchors','E: other-trust-anchors')},/unexpected elements or exceptions/],
  ['malformed manifest resource',{manifest:manifest.replace('@0x7f150003','"@xml/negresco_network_security"')},/invalid networkSecurityConfig reference/],
  ['aapt2 cannot inspect XML',{failDump:true},/aapt2 failed or exceeded output bound/]
]){
  test('compiled network policy blocks: '+label,t=>{
    const result=check(t,opts);
    assert.notEqual(result.status,0,label);
    assert.match(result.stderr+result.stdout,reason);
  });
}

test('publisher re-audits downloaded compiled XML before remote GitHub mutation',()=>{
  const job=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
  const step=job.indexOf('      - name: Independently audit downloaded compiled network XML');
  const stage=job.indexOf('      - name: Stage private draft and publish only after complete verified upload');
  const tag=job.indexOf('gh api -X POST "repos/' + '$' + '{GH_REPO}/git/refs"');
  assert.ok(step>0&&stage>step&&tag>stage);
  assert.match(auditStep,/test -x "\$BUILD_TOOLS\/aapt2"/);
  assert.match(auditStep,/python3 - "\$BUILD_TOOLS\/aapt2" Negresco-Finance-V3\.1\.3-preview\.apk/);
  assert.doesNotMatch(job,/actions\/checkout/);
  assert.match(workflow,/tests\/android-publish-compiled-network-xml\.test\.mjs/);
});
