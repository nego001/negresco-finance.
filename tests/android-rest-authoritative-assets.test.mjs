import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const publish=workflow.slice(workflow.indexOf('      - name: Stage private draft and publish only after complete verified upload'));
const cli=publish.indexOf('gh release view "$TAG" --json isDraft,isPrerelease,tagName,databaseId');
const rest=publish.indexOf('gh api "repos/${GH_REPO}/releases/$(cat "$RELEASE_DRAFT_ID_FILE")"');
const makePublic=publish.indexOf('gh release edit "$TAG" --draft=false');

test('CLI does not require nested release assets for publication eligibility',()=>{
  assert.ok(cli>=0&&rest>cli&&makePublic>rest);
  const cliBlock=publish.slice(cli,rest);
  assert.doesNotMatch(cliBlock,/release\.assets|asset\.digest|asset\.state/);
  assert.match(cliBlock,/release\.isDraft !== true/);
  assert.match(cliBlock,/release\.isPrerelease !== true/);
  assert.match(cliBlock,/release\.tagName !== process\.env\.RELEASE_TAG/);
  assert.match(cliBlock,/Number\.isSafeInteger\(release\.databaseId\)/);
});

test('REST release response is mandatory authority for four uploaded files',()=>{
  const proof=publish.slice(rest,makePublic);
  assert.match(proof,/release\.assets\.length !== required\.length/);
  assert.match(proof,/names\.has\(asset\.name\)/);
  assert.match(proof,/asset\.state !== "uploaded"/);
  assert.match(proof,/asset\.size !== fs\.statSync\(asset\.name\)\.size/);
  assert.match(proof,/asset\.digest !== \("sha256:" \+/);
  assert.match(proof,/crypto\.createHash\("sha256"\)/);
  assert.match(proof,/REST draft asset SHA256 or metadata differs/);
  assert.match(proof,/release\.id !== expectedId/);
  assert.doesNotMatch(proof,/continue-on-error:\s*true/);
});

test('REST proof stays between upload and visibility change',()=>{
  assert.ok(publish.indexOf('gh release upload "$TAG"')<rest);
  assert.ok(publish.lastIndexOf('verify_immutable_policy')<makePublic);
  assert.match(workflow,/tests\/android-rest-authoritative-assets\.test\.mjs/);
});
