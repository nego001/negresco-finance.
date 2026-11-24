import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const old=readFileSync('.github/workflows/guardiao-api28-debug-legacy-nav-m84.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-root-hitorder-ablation-m85.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_api28_debug_root_hitorder_ablation_m85.py','utf8');
const app=readFileSync('apps/mobile/App.tsx','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const gate=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_guard.py','utf8');
const outside=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_ROOT_HITORDER_ABLATION_M85.md','utf8');

test('M85 workflow exactly equals M84 plus one guarded temporary root-style subtraction',()=>{
 let expected=old;
 for(const[a,b]of [["name: Guardiao API28 Debug legacy-nav style comparison M84","name: Guardiao API28 Debug root hit-order ablation M85"],["lab/p01-guardiao-api28-debug-legacy-nav-m84-v1","lab/p01-guardiao-api28-debug-root-hitorder-ablation-m85-v1"],["guardiao-debug-legacy-nav-m84-","guardiao-debug-root-hitorder-m85-"],["name: M84 trial ${{ matrix.trial }} - legacy nav style comparison","name: M85 trial ${{ matrix.trial }} - root hit-order ablation"],["name: Compare unmodified geometry guards against two removed style overrides","name: Compare strict geometry gates after root hit-order style subtraction"]]){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 const after='          python3 tooling/android/guardiao_api28_debug_legacy_nav_variant_m84.py apply\n';
 assert.equal(expected.split(after).length,2);
 expected=expected.replace(after,after+'      - name: Remove only root hit-order reference in disposable Debug workspace\n        run: |\n          set -euo pipefail\n          python3 tooling/android/guardiao_api28_debug_root_hitorder_ablation_m85.py apply\n');
 assert.equal(current,expected);
 assert.match(current,/trial: \[1, 2\]/);
 assert.match(current,/fail-fast: false/);
 assert.match(current,/api-level: 28/);
 assert.match(current,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(current,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M85 strict stage-only ablation checks original root and M84 precondition',()=>{
 assert.equal(app.split(",Platform.OS==='android'&&s.labAndroidRootHitOrder").length,2);
 assert.match(patch,/GITHUB_ACTIONS/);
 assert.match(patch,/GITHUB_REF/);
 assert.match(patch,/content.count\(ROOT_STYLE\) != 1/);
 assert.match(patch,/content.count\(ROOT_STYLE \+ ROOT_SUFFIX\) != 1/);
 assert.match(patch,/content.count\(BOTTOM_STYLE\) != 1/);
 assert.match(patch,/content.count\(NAV_STYLE\) != 1/);
 assert.match(gate,/safe_ancestor_constraint_category/);
 assert.match(runner,/if category != gate\.ELIGIBLE or pix_center is None:/);
 assert.match(runner,/if category != gate\.ELIGIBLE or home_center is None:/);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/g)||[]).length,1);
 assert.match(outside,/\("idle-observed", "all-present", "PPP"\)/);
});
test('M85 pure transformation changes root style only, rejects omitted/ambiguous and unprepared M84',()=>{
 const py=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_root_hitorder_ablation_m85 as m',
 "good='start style={s.bottom} style={[s.nav,page===x.name&&s.navSelected]} root'+m.ROOT_STYLE+m.ROOT_SUFFIX+' end'",
 'after=m.transform(good)',
 'assert after==good.replace(m.ROOT_STYLE+m.ROOT_SUFFIX,m.ROOT_SUFFIX)',
 'assert len(good)-len(after)==len(m.ROOT_STYLE)',
 "for bad in ('',good + m.ROOT_STYLE, after,good.replace(m.BOTTOM_STYLE,''),good.replace(m.NAV_STYLE,'')):",
 ' try: m.transform(bad); raise AssertionError("must block")',
 ' except RuntimeError: pass',
 "print('PASS (LAB): one exact root style ablation, strict M84 precondition')"
 ].join('\n');
 const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): one exact root style ablation, strict M84 precondition/);
});
test('M85 retains original P0 prohibitions and historical results',()=>{
 for(const x of ['M77','M79','M81','M82','M83','M84','M85','1,717/1,717','#120','#126',
 'approvedForProduction=false','stableReleaseAllowed=false','Draft','No timeout'])
  assert.ok(doc.includes(x),x);
});
