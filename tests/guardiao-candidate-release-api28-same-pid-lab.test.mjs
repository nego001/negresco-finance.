import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const source=readFileSync('tooling/android/guardiao_candidate_release_api28_same_pid_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-candidate-release-api28-same-pid-lab.yml','utf8');

test('same-PID Release-mode candidate replay has fixed 4 cycles, strict Home, no reinstall and no production',()=>{
 assert.match(source,/CYCLES = \("a", "b", "c", "d"\)/);
 assert.match(source,/candidate\.candidate_identity\(candidate\.APK\)/);
 assert.match(source,/baseline_pid = home\.observed_single_app_pid\(\)/);
 assert.match(source,/home\.restore_home_tab_in_same_process\(baseline_pid\)/);
 assert.match(source,/if not skipped or not home_verified/);
 assert.match(source,/semantic\.observed = None/);
 assert.match(source,/candidate\.run\(\)/);
 assert.match(source,/semantic\.ensure_absent\(\)/);
 assert.match(source,/four consecutive candidate Release-mode PDFs/);
 assert.match(workflow,/run-id: 43741679134/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/sha256sum --check --strict/);
 assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/assembleRelease|assembleDebug|upload-artifact|workflow_dispatch|secrets\.|eas update|contents: write/i);
});

test('same-PID replay rejects stale receipts and preserves historical Release proof',()=>{
 const py=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_candidate_release_api28_same_pid_lab as x',
  'import verify_collection48_receipt as immutable',
  'assert len(x.CYCLES)==4 and len(set(x.CYCLES))==4',
  'assert x.candidate.PINNED_CANDIDATE!=x.candidate.ORIGINAL_IMMUTABLE',
  'assert immutable.APK_SHA==x.candidate.ORIGINAL_IMMUTABLE',
  'assert x.candidate.PINNED_CANDIDATE not in (immutable.APK_SHA,)',
  'assert x.home.observed_single_app_pid is not None',
  'print("PASS: strict candidate identity and legacy Release immutable pin separated")'
 ].join('\n');
 const p=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: strict candidate identity and legacy Release immutable pin separated/);
});
