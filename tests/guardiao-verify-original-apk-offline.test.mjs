import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const script=readFileSync('tooling/android/guardiao_verify_original_apk_offline.py','utf8');

test('recovered original APK can only be verified offline against embedded exact SHA',()=>{
 assert.match(script,/ORIGINAL_APK_SHA256 = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(script,/def classify_candidate\(path: Path, expected_sha: str = ORIGINAL_APK_SHA256\)/);
 assert.match(script,/def main\(argv: list\[str\]\) -> int:/);
 assert.match(script,/len\(argv\) != 2/);
 assert.match(script,/path\.lstat\(\)/);
 assert.match(script,/os\.O_NOFOLLOW/);
 assert.match(script,/os\.fstat\(/);
 assert.match(script,/hashlib\.sha256\(\)/);
 assert.match(script,/digest\.hexdigest\(\) != expected_sha/);
 assert.match(script,/REQUIRED_APK_PARTS\.issubset/);
 assert.doesNotMatch(script,/subprocess|urlopen|requests|http:|https:|print\(digest\)|print\(path\)|write_bytes|extractall|chmod\(|os\.system/);
});

test('offline candidate identity rejects mismatches and invalid ZIP, no fake original CLI override',()=>{
 const py=[
  'import sys,hashlib,tempfile,zipfile',
  'from pathlib import Path',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_verify_original_apk_offline as x',
  'with tempfile.TemporaryDirectory() as directory:',
  ' p=Path(directory)/"recovered.apk"',
  ' with zipfile.ZipFile(p,"w",compression=zipfile.ZIP_STORED) as z:',
  '  z.writestr("AndroidManifest.xml",b"M"*650000)',
  '  z.writestr("classes.dex",b"D"*650000)',
  ' expected=hashlib.sha256(p.read_bytes()).hexdigest()',
  ' assert x.classify_candidate(p,expected)=="original-apk-exact-bytes-verified-for-lab-only"',
  ' assert x.classify_candidate(p)=="original-apk-sha256-mismatch"',
  ' assert x.main(["script",str(p)])==1',
  ' q=Path(directory)/"link.apk";q.symlink_to(p)',
  ' assert x.classify_candidate(q,expected)=="original-apk-file-unconfirmed"',
  ' broken=Path(directory)/"broken.apk";broken.write_bytes(b"Z"*1100000)',
  ' assert x.classify_candidate(broken,hashlib.sha256(broken.read_bytes()).hexdigest())=="original-apk-inspection-unavailable"',
  ' assert x.classify_candidate(p.with_suffix(".zip"),expected)=="original-apk-extension-unconfirmed"',
  ' print("PASS: exact offline candidate only, wrong SHA/symlinks/bad zip blocked")'
 ].join('\n');
 const p=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: exact offline candidate only/);
});
