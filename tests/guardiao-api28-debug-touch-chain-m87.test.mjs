import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-api28-debug-postpix-classifier-m86b.yml','utf8');
const wf=readFileSync('.github/workflows/guardiao-api28-debug-touch-chain-m87.yml','utf8');
const cli=readFileSync('tooling/android/guardiao_api28_debug_touch_preflight_m87.py','utf8');
const pure=readFileSync('tooling/android/guardiao_api28_debug_touch_chain_m87.py','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const stage=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const app=readFileSync('apps/mobile/App.tsx','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_TOUCH_CHAIN_M87.md','utf8');

test('M87 workflow exact M86b, only branch/name/own-branch pure transform CLI',()=>{
 let x=old;
 for(const [a,b] of [["name: Guardiao API28 Debug post-Pix passive attribution M86b corrected preflight","name: Guardiao API28 Debug exact post-Pix touch-chain markers M87"],["lab/p01-guardiao-api28-debug-postpix-classifier-m86b-v1","lab/p01-guardiao-api28-debug-touch-chain-m87-v1"],["guardiao-debug-postpix-m86b-","guardiao-debug-touch-chain-m87-"],["name: M86b trial ${{ matrix.trial }} - scoped post-Pix diagnosis","name: M87 trial ${{ matrix.trial }} - source-defined touch-chain flags"],["name: Distinguish existing post-Pix states after corrected Debug preflight","name: Classify existing post-Pix event flags without extra Android reads"],["python3 tooling/android/guardiao_api28_debug_postpix_preflight_m86b.py apply","python3 tooling/android/guardiao_api28_debug_touch_preflight_m87.py apply"]]){assert.equal(x.split(a).length,2,a);x=x.replace(a,b);}
 assert.equal(wf,x);
 assert.equal(wf.match(/^\s+- (lab\/p01-guardiao-api28-debug-touch-chain-m87-v1)$/m)?.[1],
   cli.match(/LAB_REF = "refs\/heads\/([^"]+)"/)?.[1]);
 assert.match(cli,/GITHUB_ACTIONS/);
 assert.match(cli,/GITHUB_REF/);
 assert.match(cli,/old_pure_transform\(original\)/);
 assert.doesNotMatch(wf,/python3 tooling\/android\/guardiao_api28_debug_postpix_preflight_m86b\.py apply/);
 assert.match(wf,/trial: \[1, 2\]/);
 assert.match(wf,/fail-fast: false/);
 assert.match(wf,/api-level: 28/);
 assert.match(wf,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(wf,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M87 only categorizes the original post-Pix nodes; no new ADB, snapshots, taps or waits',()=>{
 assert.equal((runner.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/g)||[]).length,1);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.match(runner,/if POST_PIX_DIAGNOSTIC == "post-pix-home-still-visible":/);
 assert.match(runner,/TOUCH_CHAIN_DIAGNOSTIC = touch_chain\.classify_home_visible\(nodes\)/);
 assert.match(runner,/if not pix_static_proven\(nodes\):/);
 assert.match(runner,/if category != gate\.ELIGIBLE or home_center is None:/);
 assert.match(stage,/ENV \(LAB\): debug-nav-touch-chain=/);
 assert.match(stage,/if touch not in CHAIN_CATEGORIES:/);
});
test('M87 fixed pure source-owned flag strings only, no device or private outputs',()=>{
 for(const flag of ['setLabPixPressIn(true)','setLabPixNavCall(true)','setLabRootTouchStart(true)','setLabBottomTouchStart(true)'])
  assert.ok(app.includes(flag),flag);
 for(const x of ['touch-chain-header-unconfirmed','touch-chain-marker-sequence-unresolved','touch-chain-root-not-marked','touch-chain-root-marked-bottom-not-marked','touch-chain-bottom-marked-pressin-not-marked','touch-chain-pressin-marked-nav-not-marked','touch-chain-nav-marked-home-still-visible','not-started'])
  assert.ok(pure.includes('"'+x+'"'),x);
 assert.match(pure,/HEADER\.fullmatch\(headers\[0\]\)/);
 assert.match(pure,/len\(headers\) != 1/);
 assert.doesNotMatch(pure,/\.adb\(|xml_nodes\(|subprocess\.|\binput\(|\bscreenshot\(|\bprint\(|time\.sleep\(|requests\.|urllib\.|socket\.|logging\.|\bopen\(/);
});
test('M87 categories: root/footer/pressIn/call and exact malformed/foreign rejection',()=>{
 const py=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_touch_chain_m87 as m',
 'import guardiao_api28_debug_home_readiness_census_lab as h',
 'def node(p,c,r,b):',
 " return {'package':h.PACKAGE,'resource-id':'com.demo:id/negresco-lab-rn-page-home-pressin-'+p+'-call-'+c+'-rootstart-'+r+'-bottomstart-'+b}",
 "cases=[(('no','no','no','no'),'touch-chain-root-not-marked'),(('no','no','yes','no'),'touch-chain-root-marked-bottom-not-marked'),(('no','no','yes','yes'),'touch-chain-bottom-marked-pressin-not-marked'),(('yes','no','yes','yes'),'touch-chain-pressin-marked-nav-not-marked'),(('yes','yes','yes','yes'),'touch-chain-nav-marked-home-still-visible'),(('no','yes','yes','yes'),'touch-chain-marker-sequence-unresolved')]",
 'for flags,cat in cases: assert m.classify_home_visible([node(*flags)]) == cat',
 "assert m.classify_home_visible([])=='touch-chain-header-unconfirmed'",
 "assert m.classify_home_visible(None)=='touch-chain-header-unconfirmed'",
 "assert m.classify_home_visible([node('no','no','no','no')]*2)=='touch-chain-header-unconfirmed'",
 "assert m.classify_home_visible([dict(node('no','no','no','no'),**{'package':'foreign'})])=='touch-chain-header-unconfirmed'",
 "assert m.classify_home_visible([{'package':h.PACKAGE,'resource-id':'negresco-lab-rn-page-home-pressin-yes-call-MALFORMED'}])=='touch-chain-header-unconfirmed'",
 "print('PASS (LAB): M87 exact allowlisted touch-chain flags')"
 ].join('\n');
 const res=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});
 assert.equal(res.status,0,res.stderr);
 assert.match(res.stdout,/PASS \(LAB\): M87 exact allowlisted touch-chain flags/);
});
test('M87 branch-specific source patch equals M86b pure transform, release locked',()=>{
 const py=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_touch_preflight_m87 as a',
 'import guardiao_api28_debug_postpix_preflight_m86b as b',
 "src=open('apps/mobile/App.tsx',encoding='utf8').read()",
 'assert a.transform(src)==b.transform(src)',
 "for bad in ('',a.transform(src),src+src):",
 ' try: a.transform(bad);raise AssertionError("unsafe input")',
 ' except RuntimeError: pass',
 "print('PASS (LAB): M87 scoped pure transform')"
 ].join('\n');
 const res=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});
 assert.equal(res.status,0,res.stderr);
 for(const x of ['M77','M79','M81','M83','M84','M85','M85b','M86','M86b','M87',
  '1,735/1,735','#120','#126','approvedForProduction=false','stableReleaseAllowed=false','Draft'])
  assert.ok(doc.includes(x),x);
});
