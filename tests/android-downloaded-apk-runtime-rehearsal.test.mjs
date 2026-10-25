import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
const source=readFileSync(resolve('tooling/android/verify_compiled_ota_runtime.py'),'utf8');
const jobStart='  verify-downloaded-ota-runtime:';
const publishStart='  publish-test-prerelease:';
const begin=workflow.indexOf(jobStart),end=workflow.indexOf(publishStart);
assert.ok(begin>0&&end>begin,'read-only replay must be a distinct job before the publisher');
const job=workflow.slice(begin,end);
const integrityStart='      - name: Check downloaded test APK integrity';
const replayStart='      - name: Reverify downloaded compiled OTA runtime (read only)';
const hashBlock=job.slice(job.indexOf(integrityStart),job.indexOf(replayStart));
const hashMatch=/^          python3 - <<'PY'\r?\n([\s\S]*?)^          PY$/m.exec(hashBlock);
const runtimeMatch=/^          python3 - "\$APK" "\$BUILD_TOOLS\/aapt2" 3\.1\.3 <<'PY'\r?\n([\s\S]*?)^          PY$/m.exec(job);
assert.ok(hashMatch&&runtimeMatch,'read-only replay should contain both independent inline auditors');
const unindent=body=>body.split(/\r?\n/).map(l=>l.startsWith('          ')?l.slice(10):l).join('\n').trimEnd()+'\n';
const checksumCode=unindent(hashMatch[1]),runtimeCode=unindent(runtimeMatch[1]);

const artifactAPK='android/app/build/outputs/apk/release/app-release.apk';
function fixture(t,content='synthetic APK bytes for SHA integrity control'){
  const dir=mkdtempSync(join(tmpdir(),'negresco-downloaded-apk-replay-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const apk=join(dir,artifactAPK),list=join(dir,'android-apk.sha256');
  mkdirSync(dirname(apk),{recursive:true});
  writeFileSync(apk,content);
  const digest=createHash('sha256').update(content).digest('hex');
  writeFileSync(list,digest+'  '+artifactAPK+'\n');
  return {dir,apk,list,digest};
}
function inspect(f){
  return spawnSync('python3',['-'],{input:checksumCode,cwd:f.dir,encoding:'utf8',timeout:10000});
}
function accepted(f){
  const r=inspect(f);
  assert.equal(r.status,0,r.stderr+r.stdout);
  assert.match(r.stdout,/downloaded APK bytes match artifact SHA-256/);
}
function denied(f,pattern){
  const r=inspect(f);
  assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.match(r.stderr,pattern);
}
test('read-only audit is a separate dependency on build, without checkout or contents:write',()=>{
  assert.match(job,/needs: build-test-apk/);
  assert.match(job,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(job,/actions\/checkout|contents: write|secrets\./);
  assert.match(job,/actions\/download-artifact@v4/);
  assert.match(job,/name: negresco-finance-v313-test-apk/);
  assert.match(job,/path: verified-artifact/);
});
test('runtime auditor embedded in read-only job matches the published trusted policy script',()=>{
  assert.equal(runtimeCode,source);
  const publisher=workflow.slice(end);
  const match=/python3 - Negresco-Finance-V3\.1\.3-preview\.apk "\$BUILD_TOOLS\/aapt2" 3\.1\.3 <<'PY'\r?\n([\s\S]*?)^          PY$/m.exec(publisher);
  assert.ok(match,'publisher must contain an independent inline auditor');
  assert.equal(unindent(match[1]),runtimeCode);
});
test('read-only job checks integrity and Android signature before runtime audit',()=>{
  assert.ok(job.indexOf(integrityStart)>0);
  assert.ok(job.indexOf(replayStart)>job.indexOf(integrityStart));
  assert.match(job,/apksigner" verify --verbose "\$APK"/);
  assert.match(job,/test -x "\$BUILD_TOOLS\/aapt2"/);
  assert.match(job,/python3 - "\$APK" "\$BUILD_TOOLS\/aapt2" 3\.1\.3/);
});
test('canonical SHA manifest accepts exactly the same downloaded APK bytes',t=>{
  accepted(fixture(t));
});
test('rehearsal rejects an altered APK after checksum creation',t=>{
  const f=fixture(t);
  writeFileSync(f.apk,'different bytes despite preserved checksum');
  denied(f,/differs from build artifact manifest/);
});
test('rehearsal rejects a checksum list naming a different path',t=>{
  const f=fixture(t);
  writeFileSync(f.list,f.digest+'  ../../outside-apk.apk\n');
  denied(f,/manifest is not canonical/);
});
test('rehearsal rejects a checksum manifest with extra commands or files',t=>{
  const f=fixture(t);
  writeFileSync(f.list,f.digest+'  '+artifactAPK+'\n'+f.digest+'  ../other.apk\n');
  denied(f,/manifest is not canonical/);
});
test('rehearsal rejects checksum digests containing invalid characters',t=>{
  const f=fixture(t);
  writeFileSync(f.list,'Z'.repeat(64)+'  '+artifactAPK+'\n');
  denied(f,/manifest is not canonical/);
});
test('rehearsal rejects a symlinked downloaded APK',t=>{
  const f=fixture(t);
  const alternate=join(f.dir,'alternate.apk');
  writeFileSync(alternate,readFileSync(f.apk));
  rmSync(f.apk);
  symlinkSync(alternate,f.apk);
  denied(f,/APK\/checksum missing or linked/);
});
test('rehearsal rejects a symlinked checksum file',t=>{
  const f=fixture(t);
  const alternate=join(f.dir,'other-list.txt');
  writeFileSync(alternate,readFileSync(f.list));
  rmSync(f.list);
  symlinkSync(alternate,f.list);
  denied(f,/APK\/checksum missing or linked/);
});
test('rehearsal rejects absent downloaded APK and absent checksum',t=>{
  const f=fixture(t);
  rmSync(f.apk);
  denied(f,/APK\/checksum missing or linked/);
  writeFileSync(f.apk,'anything');
  rmSync(f.list);
  denied(f,/APK\/checksum missing or linked/);
});
test('workflow trigger includes the downloaded APK replay suite',()=>{
  assert.match(workflow,/tests\/android-downloaded-apk-runtime-rehearsal\.test\.mjs/);
});
