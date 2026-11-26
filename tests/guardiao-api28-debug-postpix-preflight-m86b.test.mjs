import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
historicalAppPath();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const old=readFileSync('.github/workflows/guardiao-api28-debug-postpix-classifier-m86.yml','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-postpix-classifier-m86b.yml','utf8');
const script=readFileSync('tooling/android/guardiao_api28_debug_postpix_preflight_m86b.py','utf8');
const previous=readFileSync('tooling/android/guardiao_api28_debug_root_hitorder_ablation_m85b.py','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const stage=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_POSTPIX_PREFLIGHT_M86B.md','utf8');

test('M86b workflow differs from M86 ONLY in own branch, labels and safer correct-ref preflight',()=>{
 let expected=old;
 for(const [a,b] of [["name: Guardiao API28 Debug post-Pix passive attribution M86","name: Guardiao API28 Debug post-Pix passive attribution M86b corrected preflight"],["lab/p01-guardiao-api28-debug-postpix-classifier-m86-v1","lab/p01-guardiao-api28-debug-postpix-classifier-m86b-v1"],["guardiao-debug-postpix-m86-","guardiao-debug-postpix-m86b-"],["name: M86 trial ${{ matrix.trial }} - passive post-Pix diagnosis","name: M86b trial ${{ matrix.trial }} - scoped post-Pix diagnosis"],["name: Diagnose already captured post-Pix state without extra Android reads","name: Distinguish existing post-Pix states after corrected Debug preflight"],["python3 tooling/android/guardiao_api28_debug_root_hitorder_ablation_m85b.py apply","python3 tooling/android/guardiao_api28_debug_postpix_preflight_m86b.py apply"]]){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
 assert.match(workflow,/trial: \[1, 2\]/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/python3 tooling\/android\/guardiao_api28_debug_postpix_preflight_m86b.py apply/);
 assert.doesNotMatch(workflow,/python3 tooling\/android\/guardiao_api28_debug_root_hitorder_ablation_m85b\.py apply/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M86b executable patcher LAB_REF MUST match ONLY its GitHub workflow branch',()=>{
 const workflowBranch=workflow.match(/^\s+- (lab\/p01-guardiao-api28-debug-postpix-classifier-m86b-v1)$/m)?.[1];
 const ref=script.match(/LAB_REF = "refs\/heads\/([^"]+)"/)?.[1];
 assert.equal(workflowBranch,'lab/p01-guardiao-api28-debug-postpix-classifier-m86b-v1');
 assert.equal(ref,workflowBranch);
 assert.match(script,/GITHUB_ACTIONS/);
 assert.match(script,/GITHUB_REF/);
 assert.match(script,/m85b_transform\(original\)/);
 assert.match(script,/if not source\.is_file\(\) or source\.is_symlink\(\):/);
 assert.match(previous,/LAB_REF = "refs\/heads\/lab\/p01-guardiao-api28-debug-root-hitorder-ablation-m85b-v1"/);
 assert.doesNotMatch(script,/\bsubprocess\.|\bos\.system\(|\.adb\(|xml_nodes\(|\binput\(|\bprint\(.*nodes/);
});
test('M86b exact in-memory source transform equals reviewed M85b pure variant',()=>{
 const py=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_postpix_preflight_m86b as n',
 'import guardiao_api28_debug_root_hitorder_ablation_m85b as b',
 "original=open('tooling/android/fixtures/m139-historical-baseline/App.tsx',encoding='utf-8').read()",
 'assert n.transform(original)==b.transform(original)',
 'assert n.transform(original)!=original',
 "for bad in ('',n.transform(original),original+original):",
 ' try: n.transform(bad); raise AssertionError("must block")',
 ' except RuntimeError: pass',
 "print('PASS (LAB): M86b strictly reuses only the original M85b pure transformations')"
 ].join('\n');
 const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M86b strictly reuses only the original M85b pure transformations/);
});
test('M86b post-Pix passive diagnostic did not increase device reads or taps',()=>{
 assert.equal((runner.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.match(runner,/POST_PIX_DIAGNOSTIC = post_pix_classifier\.classify_missing_pix\(nodes\)/);
 assert.match(stage,/ENV \(LAB\): debug-nav-post-pix=/);
});
test('M86b historic M86 preflight FAIL and original Release P0 locks remain explicit',()=>{
 for(const x of ['M84','M85','M85b','M86','M86b','FAIL in both jobs','1,725/1,725',
 '#120','#126','approvedForProduction=false','stableReleaseAllowed=false','Draft','no merge'])
 assert.ok(doc.includes(x),x);
});
