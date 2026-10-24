import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const publish=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const reverify=publish.indexOf('      - name: Reverify downloaded release certificate and ZIP identity');
const step=publish.slice(reverify,publish.indexOf('      - name: Stage private draft and publish only after complete verified upload'));
const tag=publish.indexOf('gh api -X POST "repos/${GH_REPO}/git/refs"');
const check=publish.indexOf('aapt" dump badging');
const signature=publish.indexOf('apksigner" verify --verbose');

test('the privileged publisher independently inspects downloaded APK metadata before any mutation',()=>{
  assert.ok(reverify>=0&&check>reverify&&check<signature&&signature<tag);
  assert.match(step,/aapt" dump badging/);
  assert.match(step,/aapt" dump permissions/);
  assert.match(step,/packageLines\.length !== 1/);
  assert.match(step,/match\[1\] !== "com\.negresco\.finance"/);
  assert.match(step,/match\[2\] !== "34"/);
  assert.match(step,/match\[3\] !== "3\.1\.3"/);
  assert.match(step,/biometric\.length !== 1/);
});

test('the package and version gate uses aapt from the runner instead of code downloaded with the artifact',()=>{
  assert.match(step,/test -x "\$BUILD_TOOLS\/aapt"/);
  assert.match(step,/test -d "\$\{ANDROID_HOME:\?Android SDK unavailable\}"/);
  assert.match(step,/unexpected signed APK identity/);
  assert.doesNotMatch(publish,/actions\/checkout/);
  assert.match(workflow,/tests\/android-publish-apk-identity\.test\.mjs/);
});
