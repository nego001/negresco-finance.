import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url),'utf8');
const job = workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const block = job.slice(job.indexOf('      - name: Stage private draft and publish only after complete verified upload'));
const check = 'GH_TOKEN="$RELEASE_POLICY_READ_TOKEN" gh api "repos/${GH_REPO}/immutable-releases"';

test('read-only policy credential is isolated from the contents-write token',()=>{
  assert.match(block,/GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(block,/RELEASE_POLICY_READ_TOKEN: \$\{\{ secrets\.NEGRESCO_RELEASE_POLICY_READ_TOKEN \}\}/);
  assert.match(block,/if \[\[ -z "\$\{RELEASE_POLICY_READ_TOKEN:-\}" \]\]/);
  assert.match(block,/must not reuse the publishing token/);
  assert.ok(block.includes(check));
  assert.doesNotMatch(block,/gh api -X (PATCH|PUT|DELETE).*immutable-releases/);
  assert.match(job,/permissions:\n\s+contents: write/);
});

test('policy is verified before tag creation and after upload, immediately before visibility change',()=>{
  const start=block.indexOf('          verify_immutable_policy\n');
  const tag=block.indexOf('gh api -X POST "repos/${GH_REPO}/git/refs"');
  const upload=block.indexOf('gh release upload "$TAG"');
  const lastCheck=block.lastIndexOf('verify_immutable_policy');
  const publish=block.indexOf('gh release edit "$TAG" --draft=false');
  assert.ok(start>=0&&tag>start&&upload>tag&&lastCheck>upload&&publish>lastCheck);
  assert.equal(block.split(check).length-1,1,'the same policy function must be reused before and after');
});

test('no silent downgrade when policy reader is not configured',()=>{
  assert.match(block,/Read-only release policy token is missing; publication is blocked/);
  assert.match(block,/Cannot verify enabled GitHub immutable releases using Administration:read/);
  assert.match(block,/policy\.enabled !== true/);
  assert.doesNotMatch(job,/continue-on-error:\s*true/);
  assert.doesNotMatch(job,/\|\|\s*true/);
  assert.match(workflow,/tests\/android-readonly-release-policy-credential\.test\.mjs/);
});
