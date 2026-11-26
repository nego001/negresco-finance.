import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const preview=readFileSync('.github/workflows/android-apk.yml','utf8');
const w=readFileSync('.github/workflows/guardiao-tracked-integration-m149.yml','utf8');
test('M149 retains scanner push filters and blocks APK build only in isolated integration branch; manual main publication predicate remains unchanged',()=>{assert.match(preview,/push:\n    paths:/);assert.match(preview,/build-test-apk:\n    if: \$\{\{ github.ref != 'refs\/heads\/lab\/p01-guardiao-active-integration-m149-v1' \}\}/);assert.doesNotMatch(preview,/branches-ignore:/);assert.match(preview,/if: \$\{\{ github.event_name == 'workflow_dispatch' && github.ref == 'refs\/heads\/main' && inputs.publish_release && inputs.stable_signing \}\}/);assert.doesNotMatch(w,/contents: write|secrets\.|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|gh release|eas update/);assert.match(w,/git ls-files --error-unmatch apps\/mobile\/App.tsx apps\/mobile\/package.json apps\/mobile\/package-lock.json/)});
