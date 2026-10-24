import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../tooling/android/verify_release_bundle_consistency.py', import.meta.url));
const workflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const apkName = 'Negresco-Finance-V3.1.3-preview.apk';
const zipName = 'Negresco-Finance-V3.1.3-preview.zip';
const sha = data => createHash('sha256').update(data).digest('hex');

function fixture(options={}) {
  const dir = mkdtempSync(join(tmpdir(), 'negresco-release-bundle-'));
  const assembled = 'android/app/build/outputs/apk/release/app-release.apk';
  mkdirSync(join(dir,'android/app/build/outputs/apk/release'),{recursive:true});
  const original = Buffer.from('disposable-signed-apk-bytes');
  const standalone = Buffer.from(options.standalone ?? original);
  const zippedApk = Buffer.from(options.zippedApk ?? standalone);
  const signature = Buffer.from('Debug signing report only');
  const nestedSig = Buffer.from(options.zippedSignature ?? signature);
  writeFileSync(join(dir,assembled),original);
  writeFileSync(join(dir,apkName),standalone);
  writeFileSync(join(dir,'APK-SIGNATURE.txt'),signature);
  const originalRecord = sha(original)+'  '+assembled+'\n';
  writeFileSync(join(dir,'android-apk.sha256'),originalRecord);
  const zipEntries = {
    [apkName]:zippedApk.toString('base64'),
    'APK-SIGNATURE.txt':nestedSig.toString('base64'),
    'SHA256-original-apk.txt':Buffer.from(options.nestedChecksum ?? originalRecord).toString('base64'),
    'LEIA-ME.txt':Buffer.from('This is only a test fixture').toString('base64'),
  };
  if (options.extra) zipEntries['../evil.txt']=Buffer.from('bad').toString('base64');
  const makeZip = [
    'import sys,json,base64,zipfile',
    'z=zipfile.ZipFile(sys.argv[1],"w")',
    'opts=json.loads(sys.argv[3])',
    'for name,encoded in json.loads(sys.argv[2]).items():',
    '  info=zipfile.ZipInfo(name)',
    "  if opts.get('symlinkReadme') and name=='LEIA-ME.txt': info.create_system=3;info.external_attr=0o120777<<16",
    "  if opts.get('lzmaReadme') and name=='LEIA-ME.txt': info.compress_type=zipfile.ZIP_LZMA",
    "  if opts.get('bombReadme') and name=='LEIA-ME.txt': info.compress_type=zipfile.ZIP_DEFLATED",
    "  data=(b'X'*(512*1024)) if opts.get('bombReadme') and name=='LEIA-ME.txt' else base64.b64decode(encoded)",
    '  z.writestr(info,data)',
    'z.close()',
  ].join('\n');
  const make = spawnSync('python3', ['-c',makeZip,
    join(dir,zipName),JSON.stringify(zipEntries),JSON.stringify(options)],{encoding:'utf8'});
  assert.equal(make.status,0,make.stderr);
  const records = [apkName,zipName,'APK-SIGNATURE.txt'].map(
    name=>sha(readFileSync(join(dir,name)))+'  '+name).join('\n')+'\n';
  writeFileSync(join(dir,'SHA256-release.txt'),options.staleManifest ? records.replace(sha(standalone),'0'.repeat(64)) : records);
  return {dir,assembled};
}
function check(options={},mutate=()=>{}) {
  const f=fixture(options);
  try {
    mutate(f);
    return spawnSync('python3',[script,f.dir],{encoding:'utf8'});
  } finally {
    rmSync(f.dir,{recursive:true,force:true});
  }
}

test('Android workflow verifies bundle identity after packaging and before preserving artifacts',()=>{
  const packageIndex=workflow.indexOf('Package downloadable ZIP and release notes');
  const verifyIndex=workflow.indexOf('Verify APK identity across original, standalone and ZIP candidate');
  const uploadIndex=workflow.indexOf('Preserve full release bundle as Actions artifact');
  assert.ok(packageIndex>=0 && packageIndex<verifyIndex && verifyIndex<uploadIndex);
  assert.match(workflow,/python3 \.\.\/\.\.\/tooling\/android\/verify_release_bundle_consistency\.py \./);
});

test('three APK copies with the same SHA and matching signatures pass',()=>{
  const result=check();
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/PASS: assembled, standalone and ZIP APK/);
});

test('standalone APK divergence is rejected even when outer hashes are recomputed',()=>{
  const result=check({standalone:'different stand-alone APK'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/standalone APK differs/);
});

test('ZIP APK substitution is rejected even when ZIP outer checksum is correct',()=>{
  const result=check({zippedApk:'different ZIP APK'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/APK in ZIP differs/);
});

test('ZIP signature-report divergence is rejected',()=>{
  const result=check({zippedSignature:'different certificate report'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/signature report differs/);
});

test('stale published SHA256 manifest and untrusted ZIP members are both blocked',()=>{
  assert.match(check({staleManifest:true}).stderr,/SHA256-release\.txt disagrees/);
  assert.match(check({extra:true}).stderr,/duplicated, missing or extra entries/);
});

test('malformed nested original hash and missing assembled APK fail closed',()=>{
  assert.match(check({nestedChecksum:'fake hash line'}).stderr,/malformed original APK SHA256 record/);
  const missing=check({},f=>unlinkSync(join(f.dir,f.assembled)));
  assert.equal(missing.status,1);
  assert.match(missing.stderr,/absent, empty or symlinked artifact/);
});

test('ZIP symlink posing as readme cannot pass even with matching outer checksums',()=>{
  const result=check({symlinkReadme:true});
  assert.equal(result.status,1);
  assert.match(result.stderr,/symlink, directory or special file/);
});
test('ZIP LZMA file is denied to keep extractor compatibility explicit',()=>{
  const result=check({lzmaReadme:true});
  assert.equal(result.status,1);
  assert.match(result.stderr,/unsupported compression/);
});
test('highly compressible readme is rejected before unbounded expansion',()=>{
  const result=check({bombReadme:true});
  assert.equal(result.status,1);
  assert.match(result.stderr,/suspicious compression ratio/);
});

test('ZIP or APK scanner changes always trigger a candidate Android APK build',()=>{
  const pushBlock=workflow.split('  push:\n    paths:')[1]?.split('\n# Keep only')[0];
  assert.ok(pushBlock,'push path filters must be explicit');
  for (const path of [
    'tooling/android/verify_release_bundle_consistency.py',
    'tooling/android/verify_release_apk_surface.py',
    'tests/android-release-bundle-consistency.test.mjs',
    'tests/android-release-apk-debug-surface.test.mjs',
    '.github/workflows/android-apk.yml'
  ]) assert.ok(pushBlock.includes(path),path+' must trigger assembled APK check');
});
