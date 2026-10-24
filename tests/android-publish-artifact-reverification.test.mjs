import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const workflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const start = workflow.indexOf('      - name: Reverify downloaded release certificate and ZIP identity\n');
const end = workflow.indexOf('      - name: Publish APK first, ZIP second in GitHub Releases\n', start);
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
  const report = 'Signer #1 certificate SHA-256 digest: ' + PIN +
    '\nSigner #1 certificate DN: CN=Negresco Finance\n';
  let actualReport = 'Signer #1 certificate SHA-256 digest: ' + signer +
    '\nSigner #1 certificate DN: CN=' + (overrides.debug ? 'Android Debug' : 'Negresco Finance') + '\n';
  if (overrides.secondSigner) actualReport += 'Signer #2 certificate SHA-256 digest: ' + 'b'.repeat(64) + '\n';
  const mock = join(tools, 'apksigner');
  writeFileSync(mock, '#!/bin/sh\nprintf "%s\\n" "$FAKE_SIGNER_OUTPUT"\n', {mode:0o755});

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
    FAKE_SIGNER_OUTPUT:actualReport
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
  assert.match(workflow, /test ! -L "\$file"/);
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
