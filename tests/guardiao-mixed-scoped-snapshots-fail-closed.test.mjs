import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const scoped=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
const diagnostic=readFileSync('tooling/android/guardiao_v5_api28_scoped_home_failure_diagnostic_lab.py','utf8');

// Exact offline production-lab function: no emulator, no adb, no PDF, no UI input.
test('first-invalid then second-valid must still BLOCK the same return, not retry or upgrade',()=>{
 const script=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as m',
  'm.home.observed_single_app_pid=lambda: "fixed-synthetic-pid"',
  'm.BASE.screen_size=lambda: (1080,2400)',
  'seen=[]',
  'm.BASE.xml_nodes=lambda: seen.append("snapshot") or []',
  'seq=iter(("home-not-bounded",m.scoped.PASS))',
  'm.scoped.scoped_triplet_category=lambda *args: next(seq)',
  'blocked=False',
  'try: m.attest_triplet("fixed-synthetic-pid","pre-return")',
  'except RuntimeError: blocked=True',
  'assert blocked and seen==["snapshot","snapshot"]',
  'print("PASS (LAB): first-invalid second-valid snapshot remains BLOCK")'
 ].join('\n');
 const p=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:25000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/first-invalid second-valid snapshot remains BLOCK/);
 assert.doesNotMatch(p.stdout,/scoped three-tab geometry verified at pre-return/);
});

test('first-valid then second-invalid also BLOCKS without third-snapshot rescue',()=>{
 const script=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as m',
  'm.home.observed_single_app_pid=lambda: "fixed-synthetic-pid"',
  'm.BASE.screen_size=lambda: (1080,2400)',
  'seen=[]',
  'm.BASE.xml_nodes=lambda: seen.append("snapshot") or []',
  'seq=iter((m.scoped.PASS,"home-not-bounded"))',
  'm.scoped.scoped_triplet_category=lambda *args: next(seq)',
  'blocked=False',
  'try: m.attest_triplet("fixed-synthetic-pid","post-return")',
  'except RuntimeError: blocked=True',
  'assert blocked and seen==["snapshot","snapshot"]',
  'print("PASS (LAB): first-valid second-invalid snapshot remains BLOCK")'
 ].join('\n');
 const p=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:25000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/first-valid second-invalid snapshot remains BLOCK/);
 assert.doesNotMatch(p.stdout,/scoped three-tab geometry verified at post-return/);
});

test('two valid snapshots permit a single phase, but never imply PDF or release approval',()=>{
 const script=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as m',
  'm.home.observed_single_app_pid=lambda: "fixed-synthetic-pid"',
  'm.BASE.screen_size=lambda: (1080,2400)',
  'seen=[]',
  'm.BASE.xml_nodes=lambda: seen.append("snapshot") or []',
  'm.scoped.scoped_triplet_category=lambda *args:m.scoped.PASS',
  'm.attest_triplet("fixed-synthetic-pid","pre-return")',
  'assert seen==["snapshot","snapshot"]',
  'print("PASS (LAB): only two genuine scoped verdicts authorize passive attestation")'
 ].join('\n');
 const p=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:25000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/only two genuine scoped verdicts authorize passive attestation/);
 assert.doesNotMatch(p.stdout,/PDF cycle [a-d] independently verified|approvedForProduction=true/);
});

test('no source path bypasses double-attestation, and diagnostic uses original verdict unchanged',()=>{
 assert.match(scoped,/first = scoped\.scoped_triplet_category\(BASE\.xml_nodes\(\), width, height\)/);
 assert.match(scoped,/second = scoped\.scoped_triplet_category\(BASE\.xml_nodes\(\), width, height\)/);
 assert.match(scoped,/first != scoped\.PASS or second != scoped\.PASS/);
 assert.match(scoped,/attest_triplet\(pid, "pre-return"\);?\n\s*original_restore\(pid\)/);
 assert.match(scoped,/original_restore\(pid\)[^]*attest_triplet\(pid, "post-return"\)/);
 assert.match(diagnostic,/return original_attest\(expected_pid, stage\)/);
 assert.match(diagnostic,/return original_home\(expected_pid\)/);
 assert.match(diagnostic,/home\.safe_home_layout_snapshot_category = original_home_snapshot/);
 assert.doesNotMatch(scoped+diagnostic,/Promise\.race|continue-on-error|stableReleaseAllowed=true|approvedForProduction=true/);
});
