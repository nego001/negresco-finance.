import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const step=workflow.slice(workflow.indexOf('      - name: Stage private draft and publish only after complete verified upload'));

test('list every remote release, including drafts, with authenticated publishing token',()=>{
  assert.match(step,/gh api --paginate --slurp "repos\/\$\{GH_REPO\}\/releases\?per_page=100"/);
  assert.doesNotMatch(step,/gh release view "\$TAG" >\/dev\/null 2>&1/);
  assert.match(step,/release\.tag_name === process\.env\.RELEASE_TAG/);
  assert.match(step,/release\.draft !== "boolean"/);
  assert.match(step,/release already exists \(draft or published\)/);
});

test('malformed or incomplete paginated response blocks before any tag or release write',()=>{
  const preflight=step.indexOf('gh api --paginate --slurp');
  const create=step.indexOf('gh api -X POST "repos/${GH_REPO}/git/refs"');
  const publish=step.indexOf('gh release create "$TAG"');
  assert.ok(preflight>=0&&create>preflight&&publish>create);
  assert.match(step,/pages\.length === 0/);
  assert.match(step,/pages\.some\(page => !Array\.isArray\(page\)/);
  assert.match(step,/release listing is not valid JSON/);
  assert.match(step,/Cannot enumerate existing public or draft releases/);
  assert.doesNotMatch(step,/--clobber/);
});

test('administrative immutable policy remains separate from release listing',()=>{
  const policy=step.indexOf('verify_immutable_policy\n');
  const list=step.indexOf('gh api --paginate --slurp');
  assert.ok(policy>=0&&list>policy);
  assert.match(step,/GH_TOKEN="\$RELEASE_POLICY_READ_TOKEN" gh api/);
  assert.match(step,/GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow,/tests\/android-release-collision-preflight\.test\.mjs/);
});
