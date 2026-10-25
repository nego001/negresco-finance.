import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

const workflow=readFileSync(resolve('.github/workflows/mobile-npm-lock-review.yml'),'utf8');
const stable=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
const pkg=JSON.parse(readFileSync(resolve('apps/mobile/package.json'),'utf8'));

test('lockfile candidate workflow is lab-branch push only and never dispatches production',()=>{
  assert.match(workflow,/name: Mobile npm lockfile review candidate \(lab only\)/);
  assert.match(workflow,/branches:\s*\n\s+- lab\/p01-npm-lock-review-artifact-v1/);
  assert.doesNotMatch(workflow,/workflow_dispatch:|pull_request:|schedule:|branches:\s*\n\s+- main/);
});
test('dependency snapshot cannot publish, merge, tag or use write privileges',()=>{
  assert.match(workflow,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow,/contents: write|secrets\.|gh release|git push|git tag|create-release|deploy|publish-release/);
  assert.match(workflow,/persist-credentials: false/);
});
test('candidate generator cannot execute dependencies or change app manifest',()=>{
  assert.match(workflow,/node-version: '22\.16\.0'/);
  assert.match(workflow,/npm install --package-lock-only --ignore-scripts --no-audit --no-fund/);
  assert.match(workflow,/--lockfile-version=3 --registry=https:\/\/registry\.npmjs\.org\//);
  assert.match(workflow,/sha256sum -c \/tmp\/mobile-package\.sha256/);
  assert.match(workflow,/git diff --exit-code -- package\.json/);
  assert.doesNotMatch(workflow,/npm install --force|npm install --legacy-peer-deps|npm install --omit/);
});
test('review candidates run offline stable lock verification before upload',()=>{
  const verify=workflow.indexOf('verify_stable_npm_lock.cjs package.json package-lock.json');
  const upload=workflow.indexOf('      - name: Upload candidate for separate review only');
  assert.ok(verify>0 && upload>verify);
  assert.match(workflow,/tooling\/android\/verify_stable_npm_lock\.cjs/);
  assert.match(workflow,/if-no-files-found: error/);
  assert.match(workflow,/retention-days: 7/);
});
test('registry advisory capture preserves vulnerabilities without treating them as approval',()=>{
  assert.match(workflow,/npm audit --json --package-lock-only/);
  assert.match(workflow,/LOCK_AUDIT\.json/);
  assert.match(workflow,/report\.error\|\|!report\.metadata/);
  assert.match(workflow,/advisoryReportSha256:/);
  assert.match(workflow,/advisoryCounts:/);
  assert.match(workflow,/advisoryReviewed:false/);
  assert.match(workflow,/apps\/mobile\/LOCK_AUDIT\.json/);
  assert.ok(workflow.indexOf('Capture registry advisories')<
    workflow.indexOf('Generate provenance and digest for manual review'));
});
test('review metadata records source SHA, source ref, toolchain and cryptographic digest',()=>{
  for(const item of ['UNREVIEWED CANDIDATE','sourceCommit:process.env.GITHUB_SHA','sourceRef:process.env.GITHUB_REF','packageSha256:','lockSha256:','lockedPackageCount:','reviewed:false'])
    assert.ok(workflow.includes(item),item);
  assert.match(workflow,/apps\/mobile\/LOCK_REVIEW_MANIFEST\.json/);
  assert.match(workflow,/apps\/mobile\/package-lock\.json/);
});
test('preview remains free of fake lockfile and stable path still fails without a real one',()=>{
  assert.equal(existsSync(resolve('apps/mobile/package-lock.json')),false);
  assert.equal(pkg.name,'@negresco/mobile');
  assert.equal(pkg.version,'3.1.3');
  assert.match(stable,/npm ci --no-audit --no-fund/);
  assert.match(stable,/Require reviewed npm lockfile before any stable Android candidate/);
  assert.match(workflow,/name: mobile-npm-lock-unreviewed-candidate/);
});
