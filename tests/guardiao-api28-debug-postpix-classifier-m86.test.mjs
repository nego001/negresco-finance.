import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const old=readFileSync('.github/workflows/guardiao-api28-debug-root-hitorder-ablation-m85b.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-postpix-classifier-m86.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const stage=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const probe=readFileSync('tooling/android/guardiao_api28_debug_postpix_classifier_m86.py','utf8');
const guard=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_guard.py','utf8');
const source=readFileSync('apps/mobile/App.tsx','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_POSTPIX_CLASSIFIER_M86.md','utf8');

test('M86 workflow copied exactly from M85b except isolated labels, branch, concurrency',()=>{
 let expected=old;
 for(const[a,b]of [["name: Guardiao API28 Debug root hit-order ablation M85b preflight correction","name: Guardiao API28 Debug post-Pix passive attribution M86"],["lab/p01-guardiao-api28-debug-root-hitorder-ablation-m85b-v1","lab/p01-guardiao-api28-debug-postpix-classifier-m86-v1"],["guardiao-debug-root-hitorder-m85b-","guardiao-debug-postpix-m86-"],["name: M85b trial ${{ matrix.trial }} - verified isolated root ablation","name: M86 trial ${{ matrix.trial }} - passive post-Pix diagnosis"],["name: Recheck same strict geometry gates after corrected isolated style patch","name: Diagnose already captured post-Pix state without extra Android reads"]]){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(current,expected);
 assert.match(current,/trial: \[1, 2\]/);
 assert.match(current,/fail-fast: false/);
 assert.match(current,/api-level: 28/);
 assert.match(current,/python3 tooling\/android\/guardiao_api28_debug_root_hitorder_ablation_m85b.py apply/);
 assert.match(current,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(current,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M86 retains EXACT existing snapshot count, wait count and guarded tap count',()=>{
 assert.equal((runner.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.match(runner,/if not pix_static_proven\(nodes\):/);
 assert.match(runner,/gate\.select_preview_target\(\s*nodes, width, height, "pix", "home"/);
 assert.match(runner,/if category != gate\.ELIGIBLE or home_center is None:/);
 assert.match(guard,/safe_ancestor_constraint_category/);
 assert.match(runner,/POST_PIX_DIAGNOSTIC = post_pix_classifier\.classify_missing_pix\(nodes\)/);
 assert.match(stage,/ENV \(LAB\): debug-nav-post-pix=/);
 assert.equal((source.match(/s\.labAndroidRootHitOrder/g)||[]).length,1);
});
test('M86 fixed allowlist has only private-data-free labels and no device or network operations',()=>{
 for(const c of ['post-pix-home-still-visible','post-pix-content-unconfirmed','post-pix-content-attested','post-pix-home-classifier-unconfirmed','post-pix-home-target-unconfirmed','post-pix-home-target-attested','post-pix-snapshot-attested','not-started'])
   assert.ok(probe.includes('"'+c+'"'),c);
 assert.match(probe,/home\.classify_readiness\(nodes\)/);
 assert.doesNotMatch(probe,/\.adb\(|xml_nodes\(|\binput\(|\bscreenshot\(|\bprint\(|time\.sleep\(|subprocess\.|requests\.|urllib\.|socket\.|logging\.|\bopen\(/);
 assert.match(stage,/if post_pix not in POST_PIX_CATEGORIES:/);
});
test('M86 pure in-memory Home visibility classifier never reads XML or logs UI data',()=>{
 const py=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_postpix_classifier_m86 as m',
 'import guardiao_api28_debug_home_readiness_census_lab as h',
 "home=[{'package':h.PACKAGE,'class':'android.widget.TextView','text':x} for x in h.HOME_TEXT_MARKERS]",
 "assert m.classify_missing_pix(home)=='post-pix-home-still-visible'",
 "assert m.classify_missing_pix(home[:1])=='post-pix-content-unconfirmed'",
 "assert m.classify_missing_pix([])=='post-pix-content-unconfirmed'",
 "assert m.classify_missing_pix(None)=='post-pix-content-unconfirmed'",
 "assert m.classify_missing_pix([dict(x,**{'package':'foreign'}) for x in home])=='post-pix-content-unconfirmed'",
 "print('PASS (LAB): M86 pure post-Pix categories, no device or data disclosure')"
 ].join('\n');
 const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M86 pure post-Pix categories, no device or data disclosure/);
});
test('M86 records historical failures and P0/Release prohibition',()=>{
 for(const x of ['M77','M79','M81','M83','M84','M85','M85b','M86','1,725/1,725',
 '#120','#126','approvedForProduction=false','stableReleaseAllowed=false','Draft','No merge'])
   assert.ok(doc.includes(x),x);
});
