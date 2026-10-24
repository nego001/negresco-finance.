import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const step=workflow.slice(workflow.indexOf('      - name: Stage private draft and publish only after complete verified upload'));
const cli=step.indexOf('gh release view "$TAG" --json isDraft,isPrerelease,tagName,assets,databaseId');
const rest=step.indexOf('gh api "repos/${GH_REPO}/releases/$(cat "$RELEASE_DRAFT_ID_FILE")"');
const promote=step.indexOf('gh release edit "$TAG" --draft=false');
const post=step.indexOf('gh api "repos/${GH_REPO}/releases/tags/${TAG}"');

test('authenticated REST draft verification precedes the visibility transition',()=>{
  assert.ok(cli>=0&&rest>cli&&promote>rest&&post>promote);
  assert.match(step,/release\.id !== expectedId/);
  assert.match(step,/release\.tag_name !== process\.env\.RELEASE_TAG/);
  assert.match(step,/release\.draft !== true \|\| release\.prerelease !== true/);
  assert.match(step,/GH_TOKEN: \$\{\{ github\.token \}\}/);
});

test('remote draft assets must match four independent local SHA256 files',()=>{
  const block=step.slice(rest,promote);
  assert.match(block,/release\.assets\.length !== required\.length/);
  assert.match(block,/names\.has\(asset\.name\)/);
  assert.match(block,/asset\.state !== "uploaded"/);
  assert.match(block,/asset\.size !== fs\.statSync\(asset\.name\)\.size/);
  assert.match(block,/crypto\.createHash\("sha256"\)/);
  assert.match(block,/asset\.digest !== \("sha256:" \+/);
  assert.match(block,/missing required asset/);
});

test('draft REST check fails closed without destructive rollback or weaker fallback',()=>{
  const block=step.slice(rest,promote);
  assert.doesNotMatch(block,/gh release delete/);
  assert.doesNotMatch(block,/--clobber/);
  assert.doesNotMatch(block,/continue-on-error:/);
  assert.match(block,/BLOCK: REST draft/);
  assert.match(workflow,/tests\/android-draft-rest-crosscheck\.test\.mjs/);
});
