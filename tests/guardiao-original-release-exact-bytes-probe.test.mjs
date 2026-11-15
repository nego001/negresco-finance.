import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const source=readFileSync('tooling/android/guardiao_original_release_exact_bytes_probe.py','utf8');

test('immutable Release APK byte probe is read-only, pinned and production-blocked',()=>{
 assert.match(source,/EXPECTED_SHA256 = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(source,/approvedForProduction=false stableReleaseAllowed=false/);
 assert.match(source,/O_NOFOLLOW/);
 assert.match(source,/st_nlink != 1/);
 assert.match(source,/not _unchanged\(before, after\)/);
 assert.match(source,/not _unchanged\(before, final_path\)/);
 assert.match(source,/zipfile\.ZipFile\(apk\)/);
 assert.doesNotMatch(source,/requests|urllib|subprocess|os\.system|os\.remove|unlink\(|write_bytes|assembleRelease|upload-artifact/);
});

test('local recovered APK identity check rejects symlinks, binary drift and bad ZIPs',()=>{
 const code=[
  'import sys,os,hashlib,tempfile,zipfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_original_release_exact_bytes_probe as x',
  'with tempfile.TemporaryDirectory() as d:',
  ' root=Path(d);apk=root/"test.apk"',
  ' with zipfile.ZipFile(apk,"w",compression=zipfile.ZIP_STORED,allowZip64=True) as z:',
  '  z.writestr("AndroidManifest.xml",b"synthetic")',
  '  z.writestr("classes.dex",b"synthetic")',
  '  z.writestr("fixture.bin",b"\\0"*x.MIN_APK_BYTES)',
  ' assert x.probe(apk)==x.BLOCK, "pinned true Release digest must not accept fake APK"',
  ' expected=hashlib.sha256(apk.read_bytes()).hexdigest()',
  ' x.EXPECTED_SHA256=expected',
  ' assert x.probe(apk)==x.MATCH,"unit fixture must match only its own monkeypatched hash"',
  ' sym=root/"link.apk";sym.symlink_to(apk)',
  ' assert x.probe(sym)==x.BLOCK,"symlink rejected"',
  ' with apk.open("ab") as f:f.write(b"tamper")',
  ' assert x.probe(apk)==x.BLOCK,"modified bytes rejected"',
  ' corrupted=root/"binary.apk";corrupted.write_bytes(b"MZ"+b"0"*x.MIN_APK_BYTES)',
  ' assert x.probe(corrupted)==x.BLOCK,"not a ZIP Android package"',
  ' print("PASS: immutable Release local identity rejects untrusted APKs and never opens approval")',
 ].join('\n');
 const output=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:30000,maxBuffer:128*1024});
 assert.equal(output.status,0,'recovered APK local identity regression failed');
 assert.match(output.stdout,/PASS: immutable Release local identity rejects untrusted APKs and never opens approval/);
});
