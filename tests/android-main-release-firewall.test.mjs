import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
test('main candidate Android build cannot publish GitHub Release automatically',()=>{
  assert.match(workflow,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow,/contents: write|GH_TOKEN|gh release (?:create|edit|upload|view)/);
  assert.match(workflow,/uses: actions\/upload-artifact@v4/);
});
test('unreviewed stable signing is blocked before npm install and secrets',()=>{
  const i=workflow.indexOf('      - name: Fail closed on unreviewed stable signing');
  assert.ok(i!==-1);
  assert.ok(i<workflow.indexOf('      - name: Install JS dependencies'));
  const guard=workflow.slice(i,workflow.indexOf('      - name: Install JS dependencies'));
  assert.match(guard,/if: \${{ inputs\.stable_signing }}/);
  assert.match(guard,/exit 1/);
  assert.match(guard,/security audit/);
});
test('candidate build cannot receive production credentials even if earlier gate is removed',()=>{
  assert.doesNotMatch(workflow,/secrets\.|configure-release-signing\.cjs|NEGRESCO_RELEASE_(?:KEYSTORE|STORE|KEY)|NEGRESCO_EXPECTED_CERT_SHA256/);
  const begin=workflow.indexOf('      - name: Build standalone test APK (Debug certificate only)');
  const end=workflow.indexOf('      - name: Delete ephemeral signing material');
  const step=workflow.slice(begin,end);
  assert.ok(begin>=0&&end>begin);
  assert.match(step,/NEGRESCO_USE_STABLE_SIGNING: 'false'/);
  assert.match(step,/NEGRESCO_STABLE_REQUESTED:/);
  assert.match(step,/Stable signing is disabled/);
  assert.ok(step.indexOf('exit 1')<step.indexOf('./gradlew assembleRelease'));
});
test('actual signing check accepts Debug certificate only',()=>{
  const begin=workflow.indexOf('      - name: Verify APK structure and Debug signature only');
  const end=workflow.indexOf('      - name: Upload standalone APK');
  const step=workflow.slice(begin,end);
  assert.ok(begin>=0&&end>begin);
  assert.match(step,/grep -q 'CN=Android Debug'/);
  assert.doesNotMatch(step,/NEGRESCO_USE_STABLE_SIGNING|NEGRESCO_EXPECTED_CERT_SHA256/);
});
test('candidate build defaults to debug signing without enabling stable release',()=>{
  assert.match(workflow,/stable_signing:[\s\S]*?default: false/);
  assert.match(workflow,/NEGRESCO_USE_STABLE_SIGNING: 'false'/);
  assert.match(workflow,/Debug certificate/);
  assert.doesNotMatch(workflow,/publish_release:|permissions:\s*\n\s*contents: write/);
});
