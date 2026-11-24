import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-api28-debug-root-hitorder-ablation-m85.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-root-hitorder-ablation-m85b.yml','utf8');
const helper=readFileSync('tooling/android/guardiao_api28_debug_root_hitorder_ablation_m85b.py','utf8');
const m84=readFileSync('tooling/android/guardiao_api28_debug_legacy_nav_variant_m84.py','utf8');
const m85=readFileSync('tooling/android/guardiao_api28_debug_root_hitorder_ablation_m85.py','utf8');
const source=readFileSync('apps/mobile/App.tsx','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const guard=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_guard.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_ROOT_HITORDER_ABLATION_M85B.md','utf8');

test('M85b exact M85 workflow, replacing only wrong-branch preflight step with atomic branch-scoped wrapper',()=>{
 let expected=old;
 for(const [a,b] of [["name: Guardiao API28 Debug root hit-order ablation M85","name: Guardiao API28 Debug root hit-order ablation M85b preflight correction"],["lab/p01-guardiao-api28-debug-root-hitorder-ablation-m85-v1","lab/p01-guardiao-api28-debug-root-hitorder-ablation-m85b-v1"],["guardiao-debug-root-hitorder-m85-","guardiao-debug-root-hitorder-m85b-"],["name: M85 trial ${{ matrix.trial }} - root hit-order ablation","name: M85b trial ${{ matrix.trial }} - verified isolated root ablation"],["name: Compare strict geometry gates after root hit-order style subtraction","name: Recheck same strict geometry gates after corrected isolated style patch"]]){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 const a='      - name: Apply scoped two-style-only variant to disposable Debug checkout\n        run: |\n          set -euo pipefail\n          python3 tooling/android/guardiao_api28_debug_legacy_nav_variant_m84.py apply\n      - name: Remove only root hit-order reference in disposable Debug workspace\n        run: |\n          set -euo pipefail\n          python3 tooling/android/guardiao_api28_debug_root_hitorder_ablation_m85.py apply\n';
 const b='      - name: Apply exact three source style removals after M85 branch-scope failure\n        run: |\n          set -euo pipefail\n          python3 tooling/android/guardiao_api28_debug_root_hitorder_ablation_m85b.py apply\n';
 assert.equal(expected.split(a).length,2);assert.equal(current,expected.replace(a,b));
 assert.match(current,/trial: \[1, 2\]/);
 assert.match(current,/fail-fast: false/);
 assert.match(current,/api-level: 28/);
 assert.match(current,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(current,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M85b wrapper requires exact dedicated branch, only calls prior pure transforms, never calls their CLI',()=>{
 assert.match(helper,/GITHUB_REF/);
 assert.match(helper,/GITHUB_ACTIONS/);
 assert.match(helper,/LAB_REF = "refs\/heads\/lab\/p01-guardiao-api28-debug-root-hitorder-ablation-m85b-v1"/);
 assert.match(helper,/return m85_root\(m84_styles\(original\)\)/);
 assert.match(m84,/not a scoped CI Debug-only lab/);
 assert.match(m85,/LAB_REF = "refs\/heads\/lab\/p01-guardiao-api28-debug-root-hitorder-ablation-m85-v1"/);
 assert.match(helper,/if not path\.is_file\(\) or path\.is_symlink\(\):/);
 assert.doesNotMatch(helper,/\.adb\(|xml_nodes\(|subprocess|os\.system|time\.sleep|eval\(/);
 assert.match(guard,/safe_ancestor_constraint_category/);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/g)||[]).length,1);
});
test('M85b pure wrapper reproduces sequential M84 and M85 transforms exactly, without altering committed App',()=>{
 const py=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_root_hitorder_ablation_m85b as s',
 'import guardiao_api28_debug_legacy_nav_variant_m84 as a',
 'import guardiao_api28_debug_root_hitorder_ablation_m85 as b',
 "original=open('apps/mobile/App.tsx',encoding='utf-8').read()",
 'expected=b.transform(a.transform(original))',
 'assert s.transform(original)==expected',
 "assert s.transform(original)!=original",
 "for invalid in ('',original+original,expected):",
 ' try: s.transform(invalid); raise AssertionError("unsafe transform accepted")',
 ' except RuntimeError: pass',
 "print('PASS (LAB): M85b reproduces only predeclared style ablation in memory')"
 ].join('\n');
 const result=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS \(LAB\): M85b reproduces only predeclared style ablation in memory/);
});
test('M85b historical M85 BLOCK recorded, Release approvals remain forbidden',()=>{
 for(const x of ['M77','M79','M81','M83','M84','M85','M85b','1,717/1,717','#120','#126',
 'approvedForProduction=false','stableReleaseAllowed=false','Draft','FAIL in both jobs','No retries'])
 assert.ok(doc.includes(x),x);
});
