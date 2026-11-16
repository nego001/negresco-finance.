import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const file='tooling/android/guardiao_original_release_local_custody.py';
const script=readFileSync(file,'utf8');

test('original Release SHA remains immutable and no external/network/storage operations appear',()=>{
 assert.match(script,/ORIGINAL_SHA256 = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(script,/MIN_APK_BYTES = 25_000_000/);
 assert.match(script,/os\.O_NOFOLLOW/);
 assert.match(script,/os\.O_NONBLOCK/);
 assert.match(script,/stat\.S_ISREG/);
 assert.match(script,/before\.st_nlink != 1/);
 assert.match(script,/os\.fstat\(fd\)/);
 assert.match(script,/hashlib\.sha256\(\)/);
 assert.doesNotMatch(script,/requests|urllib|socket|subprocess|walk\(|rglob\(|glob\(|os\.scandir|shutil\.copy|open\([^)]*["']w|print\(path|print\(digest/);
});

test('offline inspector returns only fixed verdicts, rejects hardlinks and symlinks',()=>{
 const code=[
  "import hashlib, os, pathlib, sys, tempfile",
  "sys.path.insert(0,'tooling/android')",
  "import guardiao_original_release_local_custody as m",
  "with tempfile.TemporaryDirectory() as td:",
  " d=pathlib.Path(td)",
  " f=d/'fixture.apk'; f.write_bytes(b'offline-only-synthetic-test')",
  " h=hashlib.sha256(f.read_bytes()).hexdigest()",
  " assert m.inspect(f,expected=h,minimum=1,maximum=100)==m.MATCH",
  " assert m.inspect(f,expected='0'*64,minimum=1,maximum=100)==m.DIFFERENT",
  " assert m.inspect(f)==m.REFUSED",
  " assert m.inspect(d/'missing.apk')==m.UNAVAILABLE",
  " assert m.inspect(d/'missing.zip')==m.REFUSED",
  " assert m.inspect(f,expected='bad',minimum=1,maximum=100)==m.REFUSED",
  " s=d/'link.apk'; s.symlink_to(f)",
  " assert m.inspect(s,expected=h,minimum=1,maximum=100)==m.REFUSED",
  " hard=d/'hard.apk'; os.link(f,hard)",
  " assert m.inspect(f,expected=h,minimum=1,maximum=100)==m.REFUSED",
  " assert m.inspect(hard,expected=h,minimum=1,maximum=100)==m.REFUSED",
  " print('PASS: offline original SHA custody synthetic cases')",
 ].join('\n');
 const p=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:30000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: offline original SHA custody synthetic cases/);
});

test('CLI returns categories without echoing user-supplied file path',()=>{
 const fake='/tmp/secret-do-not-echo-original.apk';
 const p=spawnSync('python3',[file,fake],{encoding:'utf8',timeout:30000});
 assert.equal(p.status,4);
 assert.equal(p.stdout.trim(),'UNAVAILABLE');
 assert.equal(p.stderr.trim(),'');
 assert.doesNotMatch(p.stdout+p.stderr,/secret-do-not-echo-original/);
 const args=spawnSync('python3',[file],{encoding:'utf8',timeout:30000});
 assert.equal(args.status,3);
 assert.equal(args.stdout.trim(),'REFUSED_UNSAFE');
});
