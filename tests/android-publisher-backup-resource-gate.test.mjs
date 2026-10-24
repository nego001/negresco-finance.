import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const job=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const check=job.indexOf('function policyResource(name)');
const signer=job.indexOf('apksigner" verify --verbose');
const mutation=job.indexOf('gh api -X POST "repos/${GH_REPO}/git/refs"');
const block=job.slice(check,signer);

test('publisher checks both native backup resource references before remote mutation',()=>{
  assert.ok(check>=0&&signer>check&&mutation>signer);
  assert.match(block,/policyResource\("dataExtractionRules"\)/);
  assert.match(block,/policyResource\("fullBackupContent"\)/);
  assert.match(block,/backup and network policies must use distinct resource IDs/);
  assert.match(block,/missing, duplicate or invalid backup policy resource/);
});

test('publisher checks resource identifiers on application only and no silent bypass exists',()=>{
  assert.match(job,/if \(\/\^\\s\*E: \/\.test\(tree\[i\]\)\) break/);
  assert.match(block,/@0x/);
  assert.doesNotMatch(block,/continue-on-error:\s*true/);
  assert.match(job,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(job,/actions\/checkout/);
  assert.match(workflow,/tests\/android-publisher-backup-resource-gate\.test\.mjs/);
});
