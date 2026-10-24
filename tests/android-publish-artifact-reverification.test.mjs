import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const workflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const start = workflow.indexOf('      - name: Reverify downloaded release certificate and ZIP identity\n');
const end = workflow.indexOf('      - name: Stage private draft and publish only after complete verified upload\n', start);
const job = workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const block = workflow.slice(start, end);
const PIN = 'a'.repeat(64);
const APK = 'Negresco-Finance-V3.1.3-preview.apk';
const ZIP = 'Negresco-Finance-V3.1.3-preview.zip';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const recheck = block.split('        run: |\n')[1]?.split('\n').map(
  line => line.startsWith('          ') ? line.slice(10) : line
).join('\n');

function fixture(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'negresco-publish-gate-'));
  t.after(() => rmSync(dir, {recursive:true, force:true}));
  const sdk = join(dir, 'fake-android-sdk');
  const tools = join(sdk, 'build-tools', '35.0.0');
  mkdirSync(tools, {recursive:true});
  const signer = (overrides.signerHash ?? PIN);
  const report = 'Signer #1 certificate SHA-256 digest: ' + (overrides.reportHash ?? PIN) +
    '\nSigner #1 certificate DN: CN=Negresco Finance\n';
  let actualReport = 'Signer #1 certificate SHA-256 digest: ' + signer +
    '\nSigner #1 certificate DN: CN=' + (overrides.debug ? 'Android Debug' : 'Negresco Finance') + '\n';
  if (overrides.secondSigner) actualReport += 'Signer #2 certificate SHA-256 digest: ' + 'b'.repeat(64) + '\n';
  const mock = join(tools, 'apksigner');
  writeFileSync(mock, '#!/bin/sh\nprintf "%s\\n" "$FAKE_SIGNER_OUTPUT"\n', {mode:0o755});
  const aapt = join(tools, 'aapt');
  if (!overrides.aaptMissing) {
    writeFileSync(aapt, '#!/bin/sh\nif [ "$1" != dump ]; then exit 70; fi\ncase "$2" in\n badging) printf "%s\\n" "$FAKE_AAPT_BADGING";;\n permissions) printf "%s\\n" "$FAKE_AAPT_PERMISSIONS";;\n xmltree) printf "%s\\n" "$FAKE_AAPT_XMLTREE";;\n *) exit 71;;\nesac\n', {mode:0o755});
  }
  const badging = overrides.badging ?? "package: name='" +
    (overrides.packageName ?? 'com.negresco.finance') + "' versionCode='" +
    (overrides.versionCode ?? '34') + "' versionName='" +
    (overrides.versionName ?? '3.1.3') + "' platformBuildVersionName='16'";
  const permissions = overrides.permissions ?? "uses-permission: name='android.permission.USE_BIOMETRIC'";
  const xmltree = overrides.xmltree ?? [
    'N: android=http://schemas.android.com/apk/res/android',
    '  E: manifest (line=2)',
    '    E: application (line=9)',
    '      A: android:allowBackup(0x01010280)=(type 0x12)0x0',
    '      A: android:debuggable(0x0101000f)=(type 0x12)0x0',
    '      A: android:testOnly(0x01010272)=(type 0x12)0x0',
    '      A: android:dataExtractionRules(0x0101062e)=@0x7f150001',
    '      A: android:fullBackupContent(0x010104eb)=@0x7f150002',
    '      E: activity (line=15)'
  ].join('\n');

  const apk = Buffer.from('FAKE-APK-TEST-NOT-INSTALLABLE-' + '0123456789abcdef'.repeat(16));
  writeFileSync(join(dir, APK), apk);
  writeFileSync(join(dir, 'APK-SIGNATURE.txt'), report);
  const archiveMembers = {
    [APK]: (overrides.differentZipApk ? Buffer.from('SWAPPED APK!') : apk).toString('base64'),
    'APK-SIGNATURE.txt': Buffer.from(report).toString('base64'),
    'SHA256-original-apk.txt': Buffer.from(digest(apk) +
      '  android/app/build/outputs/apk/release/app-release.apk\n').toString('base64'),
    'LEIA-ME.txt': Buffer.from('TEST ONLY - NOT A REAL RELEASE').toString('base64')
  };
  const py = [
    'import sys,json,base64,zipfile',
    'entries=json.loads(sys.argv[2]);opts=json.loads(sys.argv[3])',
    'with zipfile.ZipFile(sys.argv[1],"w") as z:',
    ' for name,data in entries.items():',
    '  info=zipfile.ZipInfo(name)',
    '  if name=="LEIA-ME.txt" and opts.get("symlink"): info.create_system=3;info.external_attr=0o120777<<16',
    '  if name=="LEIA-ME.txt" and opts.get("bomb"): info.compress_type=zipfile.ZIP_DEFLATED',
    '  value=b"X"*(512*1024) if name=="LEIA-ME.txt" and opts.get("bomb") else base64.b64decode(data)',
    '  z.writestr(info,value)'
  ].join('\n');
  const zipResult = spawnSync('python3', ['-c', py, join(dir, ZIP),
    JSON.stringify(archiveMembers), JSON.stringify(overrides)], {encoding:'utf8'});
  assert.equal(zipResult.status, 0, zipResult.stderr);

  return {dir, env:{
    ...process.env, ANDROID_HOME:sdk,
    NEGRESCO_EXPECTED_CERT_SHA256:overrides.pin ?? PIN,
    FAKE_SIGNER_OUTPUT:actualReport,
    FAKE_AAPT_BADGING:badging, FAKE_AAPT_PERMISSIONS:permissions, FAKE_AAPT_XMLTREE:xmltree
  }};
}

function runGate(fixture) {
  assert.ok(recheck, 'privileged release recheck is required');
  return spawnSync('bash', ['-e', '-c', recheck], {
    cwd:fixture.dir, env:fixture.env, encoding:'utf8', timeout:15000
  });
}

test('publisher runs independent signed APK verification before gh release, without checkout', () => {
  assert.ok(start >= 0 && end > start);
  assert.match(job, /github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing/);
  assert.match(block, /NEGRESCO_EXPECTED_CERT_SHA256: \$\{\{ vars\.NEGRESCO_EXPECTED_CERT_SHA256 \}\}/);
  assert.match(block, /apksigner" verify --verbose --print-certs/);
  assert.match(block, /CERT_HASHES\[@\]/);
  assert.match(block, /REPORT_HASHES\[@\]/);
  assert.match(block, /CN\[\[:space:\]\]\*=.*Android Debug/);
  assert.doesNotMatch(job, /actions\/checkout/);
  assert.ok(job.indexOf('Reverify downloaded release certificate') <
    job.indexOf('gh release create'));
  assert.match(workflow, /stat\.isSymbolicLink\(\)/);
  assert.match(workflow, /sha256sum --strict --check SHA256-release\.txt/);
});

test('publisher accepts a self-consistent, pinned single-signer test fixture', t => {
  const result = runGate(fixture(t));
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /independently verified/);
});

test('publisher blocks the wrong APK signer even if report and ZIP checksums otherwise match', t => {
  const result = runGate(fixture(t,{signerHash:'b'.repeat(64)}));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /does not match pinned release identity/);
});

test('publisher blocks a falsified signing report even if the ZIP matches it', t => {
  const result = runGate(fixture(t,{reportHash:'b'.repeat(64)}));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /does not match pinned release identity/);
});

test('publisher fails closed when the pinned certificate is not configured', t => {
  const result = runGate(fixture(t,{pin:''}));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /Release certificate pin is missing or malformed/);
});

test('publisher blocks Debug signer and multisigner identity', t => {
  const debug = runGate(fixture(t,{debug:true}));
  assert.notEqual(debug.status, 0);
  assert.match(debug.stderr + debug.stdout, /Debug certificate/);
  const multisigner = runGate(fixture(t,{secondSigner:true}));
  assert.notEqual(multisigner.status, 0);
  assert.match(multisigner.stderr + multisigner.stdout, /Exactly one APK signing identity/);
});

test('publisher refuses swapped APK, ZIP symlink, and highly compressed ZIP members', t => {
  for (const opts of [
    {differentZipApk:true, expected:/ZIP APK differs/},
    {symlink:true, expected:/link or special file/},
    {bomb:true, expected:/suspicious compression ratio/}
  ]) {
    const result = runGate(fixture(t,opts));
    assert.notEqual(result.status, 0, JSON.stringify(opts));
    assert.match(result.stderr + result.stdout, opts.expected);
  }
});

test('publisher rejects mismatched package name, versionCode and versionName',t=>{
  for(const overrides of [
    {packageName:'com.example.fake',reason:/package name, versionCode or versionName differs/},
    {versionCode:'33',reason:/package name, versionCode or versionName differs/},
    {versionName:'3.1.2',reason:/package name, versionCode or versionName differs/},
    {badging:"package: name='com.negresco.finance' versionCode='34' versionName='3.1.3'\npackage: name='com.example.fake' versionCode='34' versionName='3.1.3'",reason:/exactly one package declaration/},
    {badging:"package: name='com.negresco.finance' versionCode=34 versionName='3.1.3'",reason:/package name, versionCode or versionName differs/}
  ]) {
    const result=runGate(fixture(t,overrides));
    assert.notEqual(result.status,0,JSON.stringify(overrides));
    assert.match(result.stderr+result.stdout,overrides.reason);
  }
});

test('publisher requires one verified USE_BIOMETRIC permission',t=>{
  for(const permissions of ["", "uses-permission: name='android.permission.INTERNET'",
    "uses-permission: name='android.permission.USE_BIOMETRIC'\nuses-permission: name='android.permission.USE_BIOMETRIC'"]) {
    const result=runGate(fixture(t,{permissions}));
    assert.notEqual(result.status,0,JSON.stringify(permissions));
    assert.match(result.stderr+result.stdout,/USE_BIOMETRIC permission/);
  }
});

test('publisher fails closed when Android build-tools aapt is missing',t=>{
  const result=runGate(fixture(t,{aaptMissing:true}));
  assert.notEqual(result.status,0);
});

test('publisher rechecks downloaded APK identity before inspecting signing certificate',()=>{
  assert.ok(block.indexOf('aapt" dump badging')>=0);
  assert.ok(block.indexOf('aapt" dump permissions')>=0);
  assert.ok(block.indexOf('aapt" dump badging')<block.indexOf('apksigner" verify'));
  assert.match(block,/exactly one package declaration is required/);
  assert.match(block,/com\\.negresco\\.finance|com\.negresco\.finance/);
  assert.match(block,/versionCode or versionName differs/);
});

const compiledManifest = [
  'N: android=http://schemas.android.com/apk/res/android',
  '  E: manifest (line=2)',
  '    E: application (line=9)',
  '      A: android:allowBackup(0x01010280)=(type 0x12)0x0',
  '      A: android:debuggable(0x0101000f)=(type 0x12)0x0',
  '      A: android:testOnly(0x01010272)=(type 0x12)0x0',
  '      A: android:dataExtractionRules(0x0101062e)=@0x7f150001',
  '      A: android:fullBackupContent(0x010104eb)=@0x7f150002',
  '      E: activity (line=15)'
].join('\n');

test('privileged publisher accepts explicit no-backup and non-debuggable Android manifest',t=>{
  const run = runGate(fixture(t,{xmltree:compiledManifest}));
  assert.equal(run.status,0,run.stdout+run.stderr);
  assert.match(run.stdout,/backup and debug flags verified/);
});

test('missing debuggable/testOnly flags retains platform safe defaults',t=>{
  const withoutDefaults = compiledManifest.split('\n')
    .filter(line=>!line.includes('android:debuggable')&&!line.includes('android:testOnly'))
    .join('\n');
  const run=runGate(fixture(t,{xmltree:withoutDefaults}));
  assert.equal(run.status,0,run.stdout+run.stderr);
});

for(const [scenario,xmltree,reason] of [
  ['default backup enabled because flag absent',
    compiledManifest.replace(/^.*android:allowBackup.*\n/m,''),/missing or duplicate application android:allowBackup/],
  ['explicit allowBackup=true',
    compiledManifest.replace('android:allowBackup(0x01010280)=(type 0x12)0x0','android:allowBackup(0x01010280)=(type 0x12)0xffffffff'),/application android:allowBackup must be false/],
  ['string-backed backup value instead of Boolean',
    compiledManifest.replace('android:allowBackup(0x01010280)=(type 0x12)0x0','android:allowBackup(0x01010280)="false"'),/application android:allowBackup must be false/],
  ['duplicate backup declaration',
    compiledManifest.replace('      E: activity', '      A: android:allowBackup(0x01010280)=(type 0x12)0x0\n      E: activity'),/missing or duplicate application android:allowBackup/],
  ['allowBackup appears on nested activity only',
    compiledManifest.replace('      A: android:allowBackup(0x01010280)=(type 0x12)0x0\n','')
      +'\n        A: android:allowBackup(0x01010280)=(type 0x12)0x0',/missing or duplicate application android:allowBackup/],
  ['debuggable explicitly true',
    compiledManifest.replace('android:debuggable(0x0101000f)=(type 0x12)0x0','android:debuggable(0x0101000f)=(type 0x12)0xffffffff'),/application android:debuggable must be false/],
  ['testOnly explicitly true',
    compiledManifest.replace('android:testOnly(0x01010272)=(type 0x12)0x0','android:testOnly(0x01010272)=(type 0x12)0xffffffff'),/application android:testOnly must be false/],
  ['duplicate debuggable declaration',
    compiledManifest.replace('      E: activity','      A: android:debuggable(0x0101000f)=(type 0x12)0x0\n      E: activity'),/missing or duplicate application android:debuggable/],
  ['missing application element',
    compiledManifest.replace('E: application (line=9)','E: activity (line=9)'),/exactly one compiled application element/],
  ['duplicate application elements',
    compiledManifest+'\n    E: application (line=99)',/exactly one compiled application element/],
  ['nonnumeric allowBackup value',
    compiledManifest.replace('=(type 0x12)0x0','=(type 0x03)0x0'),/application android:allowBackup must be false/],
]){
  test('privileged APK manifest fails closed: '+scenario,t=>{
    const result=runGate(fixture(t,{xmltree}));
    assert.notEqual(result.status,0,scenario);
    assert.match(result.stderr+result.stdout,reason);
  });
}

test('badging debuggable flag is a separate independent block',t=>{
  const good="package: name='com.negresco.finance' versionCode='34' versionName='3.1.3'"+
    "\napplication-debuggable";
  const result=runGate(fixture(t,{badging:good}));
  assert.notEqual(result.status,0);
  assert.match(result.stdout+result.stderr,/aapt badging identifies a debuggable APK/);
});

test('both Android backup exclusion resource IDs are independently checked in publisher',t=>{
  const result=runGate(fixture(t,{xmltree:compiledManifest}));
  assert.equal(result.status,0,result.stdout+result.stderr);
});

const modern="      A: android:dataExtractionRules(0x0101062e)=@0x7f150001";
const legacy="      A: android:fullBackupContent(0x010104eb)=@0x7f150002";
for(const [scenario,contents,reason] of [
  ['missing modern backup policy',compiledManifest.replace(modern+'\n',''),/dataExtractionRules/],
  ['missing legacy backup policy',compiledManifest.replace(legacy+'\n',''),/fullBackupContent/],
  ['duplicated modern policy',compiledManifest.replace(modern,modern+'\n'+modern),/dataExtractionRules/],
  ['duplicated legacy policy',compiledManifest.replace(legacy,legacy+'\n'+legacy),/fullBackupContent/],
  ['literal XML string instead of resource ref',
    compiledManifest.replace(modern,'      A: android:dataExtractionRules(0x0101062e)="@xml/negresco_no_data_extraction"'),/dataExtractionRules/],
  ['malformed resource ID',
    compiledManifest.replace(modern,modern.replace('@0x7f150001','@unknown')),/dataExtractionRules/],
  ['resource attribute copied to nested activity only',
    compiledManifest.replace(modern+'\n','')+'\n        '+modern.trim(),/dataExtractionRules/],
  ['modern and legacy refs point to same resource',
    compiledManifest.replace('@0x7f150002','@0x7f150001'),/different resource IDs/]
]){
  test('published APK backup resource gate refuses: '+scenario,t=>{
    const result=runGate(fixture(t,{xmltree:contents}));
    assert.notEqual(result.status,0,scenario);
    assert.match(result.stdout+result.stderr,reason);
  });
}
