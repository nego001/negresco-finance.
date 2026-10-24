import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const job=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const pub=job.slice(job.indexOf('      - name: Stage private draft and publish only after complete verified upload'));

test('immutable releases are required before writing Git tags or making draft release',()=>{
  const check=pub.indexOf('GH_TOKEN="$RELEASE_POLICY_READ_TOKEN" gh api "repos/${GH_REPO}/immutable-releases"');
  const createTag=pub.indexOf('gh api -X POST "repos/${GH_REPO}/git/refs"');
  const createDraft=pub.indexOf('gh release create "$TAG"');
  assert.ok(check>=0 && createTag>check && createDraft>createTag);
  assert.match(pub,/policy\.enabled !== true/);
  assert.match(pub,/immutable releases must be enabled before creating a release tag/);
  assert.match(pub,/Cannot verify enabled GitHub immutable releases/);
  assert.ok(pub.lastIndexOf('verify_immutable_policy') > pub.indexOf('gh release upload "$TAG"'));
  assert.ok(pub.lastIndexOf('verify_immutable_policy') < pub.indexOf('gh release edit "$TAG" --draft=false'));
  assert.match(pub,/Read-only release policy token is missing/);
});

test('immutability check does not call settings mutation endpoints or use untrusted code',()=>{
  assert.doesNotMatch(job,/actions\/checkout/);
  assert.doesNotMatch(pub,/gh api -X (PUT|PATCH|DELETE).*immutable-releases/);
  assert.doesNotMatch(pub,/curl .*immutable-releases/);
  assert.match(pub,/gh api "repos\/\$\{GH_REPO\}\/immutable-releases"/);
  assert.match(pub,/GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(job,/github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing/);
});

test('the workflow is wired to run immutable policy regressions',()=>{
  assert.match(workflow,/tests\/android-immutable-release-policy\.test\.mjs/);
  assert.match(workflow,/tests\/android-draft-release-atomicity\.test\.mjs/);
  const before=pub.slice(0,pub.indexOf('gh api -X POST "repos/${GH_REPO}/git/refs"'));
  assert.doesNotMatch(before,/gh release edit "\$TAG" --draft=false/);
});
