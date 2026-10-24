import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const wf=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const build=wf.slice(wf.indexOf('  build-test-apk:'),wf.indexOf('  publish-test-prerelease:'));
const publish=wf.slice(wf.indexOf('  publish-test-prerelease:'));

test('manual GitHub Release requires explicit stable signing and main ref',()=>{
  const gate="github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.publish_release && inputs.stable_signing";
  assert.ok(publish.includes(gate),'stable_signing must be in the publication job gate');
  assert.match(publish,/permissions:\s*\n      contents: write/);
  assert.match(publish,/needs: build-test-apk/);
});
test('trying publish_release with Debug signer fails the build instead of silently succeeding',()=>{
  assert.match(build,/Reject release publication with Debug signing or wrong trigger/);
  assert.match(build,/inputs\.publish_release && \(!inputs\.stable_signing/);
  assert.match(build,/Publishing requires explicitly enabled stable signing/);
  assert.match(build,/exit 1/);
});
test('only manual main signing receives secret credentials and pinned fingerprint verification',()=>{
  for(const name of ['NEGRESCO_RELEASE_KEYSTORE_B64','NEGRESCO_RELEASE_STORE_PASSWORD',
    'NEGRESCO_RELEASE_KEY_ALIAS','NEGRESCO_RELEASE_KEY_PASSWORD']){
    const line=build.split('\n').find(x=>x.trimStart().startsWith(name+':'));
    assert.ok(line,name);
    assert.match(line,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.stable_signing/);
  }
  assert.match(build,/CERT_HASH.*EXPECTED/);
  assert.match(build,/CN=Android Debug/);
});
test('push builds are read-only and do not publish',()=>{
  assert.match(wf,/permissions:\s*\n  contents: read\s*\njobs:/);
  assert.doesNotMatch(build,/contents: write|gh release create|gh release upload/);
  assert.equal((wf.match(/contents: write/g)??[]).length,1);
  assert.match(publish,/gh release upload/);
});
