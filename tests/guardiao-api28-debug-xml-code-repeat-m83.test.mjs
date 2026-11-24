import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const old=readFileSync('.github/workflows/guardiao-api28-debug-xml-code-m82.yml','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-xml-code-repeat-m83.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const observer=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const helper=readFileSync('tooling/android/guardiao_api28_debug_snapshot_exception_m81.py','utf8');
const allowed=readFileSync('tooling/android/guardiao_api28_debug_snapshot_phase_m80.py','utf8');
const stage=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_XML_CODE_REPEAT_M83.md','utf8');
test('M83 exactly copies original M82 workflow except predeclared independent three-trial sample and labels',()=>{
 let expected=old;
 const changes=[["name: Guardiao API28 Debug XML parser code attribution M82","name: Guardiao API28 Debug XML code three-trial repeat M83"],["lab/p01-guardiao-api28-debug-xml-error-code-m82-v1","lab/p01-guardiao-api28-debug-xml-code-repeat-m83-v1"],["guardiao-debug-snapshot-m82-","guardiao-debug-snapshot-m83-"],["name: M82 trial ${{ matrix.trial }} - XML parser code diagnostic","name: M83 trial ${{ matrix.trial }} - preregistered XML code repeat"],["trial: [1, 2]","trial: [1, 2, 3]"],["name: Diagnose existing XML parser error code without new reads","name: Recheck identical XML parser gate in three independent Debug emulators"]];
 for(const [a,b] of changes){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
 assert.match(workflow,/trial: \[1, 2, 3\]/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M83 retains strict input, snapshot, cleanup, PID, PPP and parser-code boundaries',()=>{
 assert.equal((runner.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/g)||[]).length,1);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((runner.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(runner,/SNAPSHOT_DIAGNOSTIC = snapshot_exception\.classify\(exc\)/);
 assert.match(runner,/finally:\s*\n\s*# Always delete exactly as before/);
 assert.match(stage,/CYCLES: tuple\[str, str\] = \("first", "second"\)/);
 assert.match(stage,/ENV \(LAB\): debug-nav-snapshot=/);
 assert.match(stage,/PASS \(LAB\): two guarded Home-Pix-Home Debug preview cycles, one PID/);
 assert.match(observer,/\("idle-observed", "all-present", "PPP"\)/);
 assert.match(observer,/time\.sleep\(30\.0\)/);
 for(const c of ['snapshot-ui-xml-no-elements','snapshot-ui-xml-unclosed-token','snapshot-ui-xml-invalid-token','snapshot-ui-xml-mismatched-tag','snapshot-ui-xml-trailing-content','snapshot-ui-xml-partial-character'])
   assert.ok(allowed.includes('"'+c+'"'),c);
 assert.match(helper,/getattr\(error, "code", None\)/);
 assert.doesNotMatch(helper,/str\(error\)|error\.position|error\.message|print\(|\.adb\(|xml_nodes\(|time\.sleep/);
});
test('M83 preserves original M81 parse BLOCK, M79 geometry uncertainty and production prohibitions',()=>{
 for(const x of ['M77','M79','M81','M82','M83','1,710/1,710','ParseError.code','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','fail-fast: false'])
   assert.ok(doc.includes(x),x);
});
