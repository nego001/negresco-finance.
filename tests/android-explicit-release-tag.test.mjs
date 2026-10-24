import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url),'utf8');
const begin = workflow.indexOf('      - name: Stage private draft and publish only after complete verified upload');
const script = workflow.slice(begin);

test('Git release tag is created explicitly for the same workflow commit',()=>{
  assert.ok(begin>=0);
  assert.match(script,/gh api -X POST "repos\/\$\{GH_REPO\}\/git\/refs"/);
  assert.match(script,/-f "ref=refs\/tags\/\$\{TAG\}"/);
  assert.match(script,/-f "sha=\$\{GITHUB_SHA\}"/);
  assert.match(script,/ref\.object\.sha !== process\.env\.GITHUB_SHA/);
  assert.match(script,/ref\.object\?\.type !== "commit"/);
});

test('draft release requires the precreated remote tag',()=>{
  assert.match(script,/gh release create "\$TAG" --verify-tag --title/);
  assert.doesNotMatch(script,/gh release create "\$TAG" --target/);
  assert.match(script,/draft.*prerelease/);
});

test('resolved Git reference is verified once before creating the draft and again after all assets',()=>{
  const define=script.indexOf('verify_exact_tag()');
  const create=script.indexOf('gh release create "$TAG"');
  const check1=script.indexOf('          verify_exact_tag',define+1);
  const publish=script.indexOf('gh release edit "$TAG" --draft=false');
  const prePublishVerify=script.slice(0,publish).lastIndexOf('verify_exact_tag');
  const postPublishVerify=script.indexOf('verify_exact_tag',publish);
  assert.ok(define>=0&&check1>=0&&check1<create&&prePublishVerify>create&&prePublishVerify<publish);
  assert.ok(postPublishVerify>publish,'audit must reverify the tag after publication');
  assert.match(script,/gh api "repos\/\$\{GH_REPO\}\/git\/ref\/tags\/\$\{TAG\}"/);
});

test('preexisting tags and draft failures do not cause release overwrite',()=>{
  assert.match(script,/Git tag already exists/);
  assert.match(script,/Cannot prove git tag is absent/);
  assert.match(script,/gh release create "\$TAG" --verify-tag/);
  assert.doesNotMatch(script,/--clobber/);
});
