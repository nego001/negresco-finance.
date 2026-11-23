import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const old=readFileSync('.github/workflows/guardiao-api28-debug-snapshot-exception-m81.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-xml-code-m82.yml','utf8');
const navigation=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const exceptionHelper=readFileSync('tooling/android/guardiao_api28_debug_snapshot_exception_m81.py','utf8');
const allowlist=readFileSync('tooling/android/guardiao_api28_debug_snapshot_phase_m80.py','utf8');
const stage=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const reader=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_XML_CODE_M82.md','utf8');

test('M82 workflow is M81 byte-for-byte except labels and isolated branch',()=>{
 let expected=old;
 const changes=[["name: Guardiao API28 Debug XML exception diagnostic M81","name: Guardiao API28 Debug XML parser code attribution M82"],["lab/p01-guardiao-api28-debug-snapshot-exception-m81-v1","lab/p01-guardiao-api28-debug-xml-error-code-m82-v1"],["guardiao-debug-snapshot-m81-","guardiao-debug-snapshot-m82-"],["name: M81 trial ${{ matrix.trial }} - capture exception diagnostic","name: M82 trial ${{ matrix.trial }} - XML parser code diagnostic"],["name: Diagnose existing XML exception without extra UI reads","name: Diagnose existing XML parser error code without new reads"]];
 for(const [a,b] of changes){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(current,expected);
 assert.match(current,/trial: \[1, 2\]/);
 assert.match(current,/fail-fast: false/);
 assert.match(current,/api-level: 28/);
 assert.match(current,/assembleDebug/);
 assert.match(current,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(current,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M82 retains original snapshot, ADB, cleanup and guarded two-tap invariants',()=>{
 assert.equal((navigation.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((navigation.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 assert.equal((navigation.match(/BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/g)||[]).length,1);
 assert.equal((navigation.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((navigation.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((navigation.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(navigation,/SNAPSHOT_DIAGNOSTIC = snapshot_exception\.classify\(exc\)/);
 assert.match(navigation,/finally:\s*\n\s*# Always delete exactly as before/);
 assert.match(reader,/adb\("shell", "uiautomator", "dump", "\/sdcard\/negresco_ui\.xml", timeout=35\)/);
 assert.match(reader,/adb\("exec-out", "cat", "\/sdcard\/negresco_ui\.xml", timeout=12\)/);
 assert.match(stage,/ENV \(LAB\): debug-nav-snapshot=/);
});
test('M82 uses only allowlisted fixed Expat code categories, never raw parser messages',()=>{
 for(const category of ['snapshot-ui-xml-no-elements','snapshot-ui-xml-unclosed-token','snapshot-ui-xml-invalid-token',
 'snapshot-ui-xml-mismatched-tag','snapshot-ui-xml-trailing-content','snapshot-ui-xml-partial-character'])
  assert.ok(allowlist.includes('"'+category+'"'),category);
 assert.match(exceptionHelper,/xml\.parsers|from xml\.parsers import expat/);
 assert.match(exceptionHelper,/getattr\(error, "code", None\)/);
 assert.doesNotMatch(exceptionHelper,/str\(error\)|error\.position|error\.message|print\(|\.adb\(|logging\.|import\s+logging|xml_nodes\(|time\.sleep|open\(|requests|urllib|socket/);
});
test('M82 synthetic XML parser rejects are categorized without XML data',()=>{
 const script=[
 'import sys,xml.etree.ElementTree as ET',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_snapshot_exception_m81 as d',
 'samples=[',
 " ('','snapshot-ui-xml-no-elements'),",
 " ('<a','snapshot-ui-xml-unclosed-token'),",
 " ('<a>\\x00</a>','snapshot-ui-xml-invalid-token'),",
 " ('<a><b></a>','snapshot-ui-xml-mismatched-tag'),",
 " ('<a/>x','snapshot-ui-xml-trailing-content'),",
 ']',
 'for xml,expected in samples:',
 ' try: ET.fromstring(xml); raise AssertionError("synthetic input unexpectedly accepted")',
 ' except ET.ParseError as exc:',
 '  assert d.classify(exc)==expected,(expected,d.classify(exc))',
 "assert d.classify(ET.ParseError('synthetic'))=='snapshot-ui-xml-parse-unconfirmed'",
 "print('PASS (LAB): M82 private-data-free Expat codes recognized')"
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M82 private-data-free Expat codes recognized/);
});
test('M82 retains previous failures and release prohibition',()=>{
 for(const t of ['M75','M76','M77','M78','M79','M80','M81','M82','1,705/1,705',
  'HTTP 429','snapshot-ui-xml-parse-unconfirmed','#120','#126','Draft',
  'approvedForProduction=false','stableReleaseAllowed=false'])
   assert.ok(doc.includes(t),t);
});
