import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const job=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const inspect=job.indexOf('aapt" dump xmltree');
const signature=job.indexOf('apksigner" verify --verbose');
const tagCreate=job.indexOf('gh api -X POST "repos/${GH_REPO}/git/refs"');
const step=job.slice(inspect,signature);

test('privileged publisher requires an independent compiled AndroidManifest.xml inspection',()=>{
  assert.ok(inspect>=0&&signature>inspect&&tagCreate>signature);
  assert.match(step,/AndroidManifest\.xml > verified-apk-manifest\.txt/);
  assert.match(step,/compiled application element is required/);
  assert.match(step,/attribute\("allowBackup", true\)/);
  assert.match(step,/attribute\("debuggable", false\)/);
  assert.match(step,/attribute\("testOnly", false\)/);
  assert.match(step,/application-debuggable/);
});

test('safe backup flag is explicit and parsed as compiled Boolean false, never default-true',()=>{
  assert.match(step,/missing or duplicate application android:/);
  assert.match(step,/type 0x12/);
  assert.match(step,/must be false/);
  assert.match(workflow,/tests\/android-publish-apk-manifest-security\.test\.mjs/);
});

test('privileged manifest inspection does not execute downloaded code or relax release permissions',()=>{
  assert.doesNotMatch(job,/actions\/checkout/);
  assert.match(job,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing/);
  assert.match(job,/permissions:\s*\n      contents: write/);
});
