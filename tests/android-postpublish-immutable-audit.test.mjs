import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const wf=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const pub=wf.slice(wf.indexOf('      - name: Stage private draft and publish only after complete verified upload'));
const publish=pub.indexOf('gh release edit "$TAG" --draft=false');
const after=pub.slice(publish);

test('require draft database identity before public release transition',()=>{
  const draft=pub.indexOf('gh release view "$TAG" --json isDraft,isPrerelease,tagName,assets,databaseId');
  assert.ok(draft>=0&&draft<publish);
  assert.match(pub,/Number\.isSafeInteger\(release\.databaseId\)/);
  assert.match(pub,/RELEASE_DRAFT_ID_FILE/);
  assert.match(pub,/fs\.writeFileSync\(process\.env\.RELEASE_DRAFT_ID_FILE/);
});

test('the publication is audited with immutable state from official REST release object',()=>{
  assert.match(after,/gh api "repos\/\$\{GH_REPO\}\/releases\/tags\/\$\{TAG\}"/);
  assert.match(after,/release\.immutable !== true/);
  assert.match(after,/release\.draft !== false/);
  assert.match(after,/release\.prerelease !== true/);
  assert.match(after,/release\.id !== expectedId/);
  assert.match(after,/release\.tag_name !== process\.env\.RELEASE_TAG/);
  assert.match(after,/asset\.digest !== \("sha256:" \+/);
  assert.match(after,/asset\.state !== "uploaded"/);
  assert.match(after,/verify_exact_tag/);
});

test('the audit does not blindly destroy already-visible releases or tags',()=>{
  assert.doesNotMatch(after,/gh release delete/);
  assert.doesNotMatch(after,/gh api -X DELETE/);
  assert.doesNotMatch(after,/--clobber/);
  assert.match(after,/manual incident review required/);
  assert.match(wf,/tests\/android-postpublish-immutable-audit\.test\.mjs/);
});
