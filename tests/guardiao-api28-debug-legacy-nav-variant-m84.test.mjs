import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
historicalAppPath();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-api28-debug-xml-code-repeat-m83.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-legacy-nav-m84.yml','utf8');
const source=readFileSync('tooling/android/guardiao_api28_debug_legacy_nav_variant_m84.py','utf8');
const app=readFileSync(historicalAppPath(),'utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const gate=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_guard.py','utf8');
const external=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_LEGACY_NAV_VARIANT_M84.md','utf8');
test('M84 workflow equals M83 except isolated names/two trials and one prebuild style step',()=>{
 let expected=old;
 const changes=[["name: Guardiao API28 Debug XML code three-trial repeat M83","name: Guardiao API28 Debug legacy-nav style comparison M84"],["lab/p01-guardiao-api28-debug-xml-code-repeat-m83-v1","lab/p01-guardiao-api28-debug-legacy-nav-m84-v1"],["guardiao-debug-snapshot-m83-","guardiao-debug-legacy-nav-m84-"],["name: M83 trial ${{ matrix.trial }} - preregistered XML code repeat","name: M84 trial ${{ matrix.trial }} - legacy nav style comparison"],["trial: [1, 2, 3]","trial: [1, 2]"],["name: Recheck identical XML parser gate in three independent Debug emulators","name: Compare unmodified geometry guards against two removed style overrides"]];
 for(const [a,b] of changes){ assert.equal(expected.split(a).length,2,a); expected=expected.replace(a,b); }
 const anchor='      - name: Install isolated mobile dependencies and prebuild a new Android test project';
 assert.equal(expected.split(anchor).length,2);
 expected=expected.replace(anchor,'      - name: Apply scoped two-style-only variant to disposable Debug checkout\n        run: |\n          set -euo pipefail\n          python3 tooling/android/guardiao_api28_debug_legacy_nav_variant_m84.py apply\n'+anchor);
 assert.equal(current,expected);
 assert.match(current,/trial: \[1, 2\]/);
 assert.match(current,/fail-fast: false/);
 assert.match(current,/api-level: 28/);
 assert.match(current,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(current,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M84 source and patcher preserve safe stage-only strict guards',()=>{
 assert.equal(app.split('style={[s.bottom,s.labBottomBounds]}').length,2);
 assert.equal(app.split('style={[s.nav,s.labNavBounds,page===x.name&&s.navSelected]}').length,2);
 assert.match(source,/GITHUB_ACTIONS/); assert.match(source,/GITHUB_REF/);
 assert.match(source,/output.count\(old\) != 1/);
 assert.match(source,/if not source.is_file\(\) or source.is_symlink\(\):/);
 assert.match(gate,/safe_ancestor_constraint_category/);
 assert.match(runner,/if category != gate\.ELIGIBLE or pix_center is None:/);
 assert.match(runner,/if category != gate\.ELIGIBLE or home_center is None:/);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.match(external,/\("idle-observed", "all-present", "PPP"\)/);
});
test('M84 pure transformation exactly changes two locations, rejects missing and ambiguous source',()=>{
 const script=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_legacy_nav_variant_m84 as m',
 "original='prefix style={[s.bottom,s.labBottomBounds]} middle style={[s.nav,s.labNavBounds,page===x.name&&s.navSelected]} end'",
 'expected=original.replace(m.REPLACEMENTS[0][0],m.REPLACEMENTS[0][1]).replace(m.REPLACEMENTS[1][0],m.REPLACEMENTS[1][1])',
 'assert m.transform(original)==expected',
 "for bad in ('',original + ' ' + m.REPLACEMENTS[0][0],expected):",
 ' try: m.transform(bad); raise AssertionError("should block")',
 ' except RuntimeError: pass',
 "print('PASS (LAB): two exact styles only and fail closed')"
 ].join('\n');
 const res=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(res.status,0,res.stderr);
 assert.match(res.stdout,/PASS \(LAB\): two exact styles only and fail closed/);
});
test('M84 keeps M83 results and original Release prohibitions explicit',()=>{
 for(const x of ['M77','M79','M81','M82','M83','M84','#120','#126','1,713/1,713',
 'HTTP 429','approvedForProduction=false','stableReleaseAllowed=false','Draft','No Android reruns'])
 assert.ok(doc.includes(x),x);
});
