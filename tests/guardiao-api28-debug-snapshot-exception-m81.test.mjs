import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const old=readFileSync('.github/workflows/guardiao-api28-debug-snapshot-boundary-m80.yml','utf8');
const workflow=readFileSync('.github/workflows/guardiao-api28-debug-snapshot-exception-m81.yml','utf8');
const navigation=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const helper=readFileSync('tooling/android/guardiao_api28_debug_snapshot_exception_m81.py','utf8');
const allowed=readFileSync('tooling/android/guardiao_api28_debug_snapshot_phase_m80.py','utf8');
const rawReader=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');
const stage=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_SNAPSHOT_EXCEPTION_M81.md','utf8');

test('M81 is exactly M80 workflow except labels, branch and isolated concurrency',()=>{
 let expected=old;
 const changes=[["name: Guardiao API28 Debug snapshot phase attribution M80","name: Guardiao API28 Debug XML exception diagnostic M81"],["lab/p01-guardiao-api28-debug-snapshot-boundary-m80-v1","lab/p01-guardiao-api28-debug-snapshot-exception-m81-v1"],["guardiao-debug-snapshot-m80-","guardiao-debug-snapshot-m81-"],["name: M80 trial ${{ matrix.trial }} - snapshot phase diagnostic","name: M81 trial ${{ matrix.trial }} - capture exception diagnostic"],["name: Diagnose existing single UI snapshot phase in two Debug emulators","name: Diagnose existing XML exception without extra UI reads"]];
 for(const [a,b] of changes){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(workflow,expected);
 assert.match(workflow,/trial: \[1, 2\]/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M81 preserves exactly one existing UI tree read, original cleanup and guarded taps',()=>{
 assert.equal((navigation.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((navigation.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 assert.equal((navigation.match(/BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/g)||[]).length,1);
 assert.equal((navigation.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((navigation.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.equal((navigation.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.match(navigation,/SNAPSHOT_DIAGNOSTIC = snapshot_exception\.classify\(exc\)/);
 assert.match(navigation,/except Exception as exc:\s*\n\s*# Pure classification of already-raised exception; never print it\.\s*\n\s*SNAPSHOT_DIAGNOSTIC = snapshot_exception\.classify\(exc\)\s*\n\s*raise/);
 assert.match(navigation,/finally:\s*\n\s*# Always delete exactly as before,[\s\S]*?BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/);
 assert.match(stage,/ENV \(LAB\): debug-nav-snapshot=/);
 assert.match(rawReader,/adb\("shell", "uiautomator", "dump", "\/sdcard\/negresco_ui\.xml", timeout=35\)/);
 assert.match(rawReader,/adb\("exec-out", "cat", "\/sdcard\/negresco_ui\.xml", timeout=12\)/);
});
test('M81 new literal categories are allowlisted and helper never touches device or exports data',()=>{
 for(const category of ['snapshot-ui-dump-timeout','snapshot-ui-dump-command-failed',
 'snapshot-ui-file-timeout','snapshot-ui-file-command-failed','snapshot-ui-xml-parse-unconfirmed',
 'snapshot-ui-tree-unconfirmed'])
   assert.ok(allowed.includes('"'+category+'"'),category);
 assert.doesNotMatch(helper,/print\(|\.adb\(|xml_nodes\(|time\.sleep|logging|open\(|requests|urllib|socket/);
});
test('M81 fixtures: original known command failure, timeout, malformed XML, and unknown fail closed',()=>{
 const script=[
 'import sys,subprocess,xml.etree.ElementTree as ET',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_api28_debug_snapshot_exception_m81 as c',
 'cases=[',
 " (subprocess.TimeoutExpired(['adb','shell','uiautomator','dump','/sdcard/negresco_ui.xml'],35),'snapshot-ui-dump-timeout'),",
 " (subprocess.TimeoutExpired(['adb','exec-out','cat','/sdcard/negresco_ui.xml'],12),'snapshot-ui-file-timeout'),",
 " (RuntimeError('command failed: adb shell uiautomator [exit code 1]'),'snapshot-ui-dump-command-failed'),",
 " (RuntimeError('command failed: adb exec-out cat [exit code 7]'),'snapshot-ui-file-command-failed'),",
 " (ET.ParseError('synthetic malformed XML'),'snapshot-ui-xml-parse-unconfirmed'),",
 " (RuntimeError('private secret: must not classify'),'snapshot-ui-tree-unconfirmed'),",
 " (RuntimeError('command failed: adb shell input [exit code 1]'),'snapshot-ui-tree-unconfirmed'),",
 " (subprocess.TimeoutExpired(['adb','shell','input','tap'],35),'snapshot-ui-tree-unconfirmed'),",
 " (ValueError('arbitrary fixture'),'snapshot-ui-tree-unconfirmed'),",
 ']',
 'for exc,expected in cases:',
 ' assert c.classify(exc)==expected,(type(exc).__name__,expected)',
 "print('PASS (LAB): M81 fixed exception category fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M81 fixed exception category fixtures/);
});
test('M81 preserves all historical blocks and preproduction prohibition',()=>{
 for(const x of ['M75','M76','M77','M78','M79','M80','M81','1,700/1,700','#120','#126',
 'approvedForProduction=false','stableReleaseAllowed=false','Draft','no retries',
 'no new ADB','No main changes','Release build'])
  assert.ok(policy.includes(x),x);
});
