import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url),'utf8');
const start = workflow.indexOf('      - name: Stage private draft and publish only after complete verified upload');
const releaseJob = workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const block = workflow.slice(start);

test('release stays gated by manual main, stable signing and trusted build',()=>{
  assert.match(releaseJob,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing/);
  assert.match(releaseJob,/needs: build-test-apk/);
  assert.match(releaseJob,/Reverify downloaded release certificate and ZIP identity/);
  assert.doesNotMatch(releaseJob,/actions\/checkout/);
});

test('publisher refuses preexisting tag and non-404 ref lookup failures',()=>{
  assert.match(block,/gh api --include "repos\/\$\{GH_REPO\}\/git\/ref\/tags\/\$\{TAG\}"/);
  assert.match(block,/Git tag already exists/);
  assert.match(block,/HTTP\/\[\^\[:space:\]\]\+ 404/);
  assert.match(block,/Cannot prove git tag is absent/);
  assert.ok(block.indexOf('git/ref/tags/')<block.indexOf('gh release create'));
});

test('publisher requires exact SHA release identity, complete asset digest and uploaded state',()=>{
  assert.match(block,/--json isDraft,isPrerelease,tagName,targetCommitish,assets/);
  assert.match(block,/release\.targetCommitish !== process\.env\.GITHUB_SHA/);
  assert.match(block,/release\.tagName !== process\.env\.RELEASE_TAG/);
  assert.match(block,/asset\.state !== "uploaded"/);
  assert.match(block,/asset\.digest !== \("sha256:" \+/);
  assert.match(block,/crypto\.createHash\("sha256"\)/);
  assert.match(block,/asset\.size !== fs\.statSync\(asset\.name\)\.size/);
});

test('publishing does not clobber and occurs strictly after draft checks',()=>{
  assert.doesNotMatch(block,/--clobber/);
  const make = block.indexOf('gh release create "$TAG"');
  const upload = block.indexOf('gh release upload "$TAG"');
  const inspect = block.indexOf('--json isDraft,isPrerelease,tagName,targetCommitish,assets');
  const publish = block.indexOf('gh release edit "$TAG" --draft=false');
  assert.ok(make>=0 && make < upload && upload < inspect && inspect < publish);
});
