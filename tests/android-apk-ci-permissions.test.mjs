import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const buildBegin = workflow.indexOf('  build-test-apk:');
const publishBegin = workflow.indexOf('  publish-test-prerelease:');
const build = workflow.slice(buildBegin,publishBegin);
const publishJob = workflow.slice(publishBegin);

test('APK workflow has read-only default token and does not publish in build job', () => {
  assert.ok(buildBegin >= 0 && publishBegin > buildBegin);
  assert.match(workflow, /permissions:\s*\n  contents: read\s*\njobs:/);
  assert.doesNotMatch(build, /contents: write|gh release create|gh release upload|GH_TOKEN/);
  assert.match(build, /python3 \.\.\/\.\.\/tooling\/android\/verify_release_apk_surface\.py "\$APK"/);
});

test('separate publishing job has narrow main-only manual gate and needs build', () => {
  assert.match(publishJob, /if: \$\{\{ github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing \}\}/);
  assert.match(publishJob, /needs: build-test-apk/);
  assert.match(publishJob, /permissions:\s*\n      contents: write/);
  assert.match(publishJob, /actions\/download-artifact@v4/);
  assert.match(publishJob, /sha256sum -c SHA256-release\.txt/);
  assert.match(publishJob, /gh release create/);
  assert.match(publishJob, /gh release upload/);
});

test('release signing material cannot be provisioned on branch builds', () => {
  assert.match(build, /Reject stable signing outside a manually dispatched main build/);
  assert.match(build, /github\.ref != 'refs\/heads\/main'/);
  for (const name of ['NEGRESCO_RELEASE_KEYSTORE_B64','NEGRESCO_RELEASE_STORE_PASSWORD',
    'NEGRESCO_RELEASE_KEY_ALIAS','NEGRESCO_RELEASE_KEY_PASSWORD']) {
    const entry=build.split('\n').find(line=>line.trimStart().startsWith(name+':'));
    assert.ok(entry,name+' missing');
    assert.match(entry, /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.stable_signing/);
  }
});

test('publishing never runs from an APK push or ordinary PR', () => {
  assert.equal((workflow.match(/contents: write/g) ?? []).length,1);
  assert.equal((workflow.match(/gh release upload/g) ?? []).length,1);
  assert.match(build, /Preserve full release bundle as Actions artifact/);
  assert.doesNotMatch(publishJob,/actions\/checkout/);
});
