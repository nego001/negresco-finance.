import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const offline=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');

const py=[
'import ast',
'from pathlib import Path',
'source=Path("tooling/android/guardiao_pdf_debug_metro_lab.py").read_text()',
'tree=ast.parse(source)',
'function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="is_legacy_offline_radio_disable")',
'ns={}',
'exec(compile(ast.Module(body=[function],type_ignores=[]),"<synthetic>", "exec"),ns)',
'gate=ns["is_legacy_offline_radio_disable"]',
'assert gate(("shell","svc","wifi","disable"),{"check":False})',
'assert gate(("shell","svc","data","disable"),{"check":False})',
'assert not gate(("shell","svc","wifi","enable"),{"check":False})',
'assert not gate(("shell","svc","data","enable"),{"check":False})',
'assert not gate(("shell","settings","put","global","wifi_on","0"),{"check":False})',
'assert not gate(("shell","svc","wifi","disable"),{"check":True})',
'assert not gate(("shell","svc","wifi","disable"),{})',
'assert not gate(("shell","svc","wifi","disable"),{"check":False,"timeout":30})',
'assert not gate(("shell","svc","wifi","disable","extra"),{"check":False})',
'assert not gate(("shell","svc","data","disable"),{"check":False,"silent":True})',
'print("PASS: only two fixed legacy radio-off commands deferred in Debug")',
].join('\n');

test('Debug-only deferred radio operations match exactly two old offline calls',()=>{
 const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:12000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: only two fixed legacy radio-off commands deferred in Debug');
});

test('Release remains offline; Debug keeps Metro and restores all hooks',()=>{
 assert.match(offline,/adb\("shell", "svc", "wifi", "disable", check=False\)/);
 assert.match(offline,/adb\("shell", "svc", "data", "disable", check=False\)/);
 assert.match(runner,/def preserve_debug_metro_radios\(\*args: str, \*\*kwargs\) -> str:/);
 assert.match(runner,/if is_legacy_offline_radio_disable\(args, kwargs\):/);
 assert.match(runner,/deferred_radios\.add\(args\[2\]\)/);
 assert.match(runner,/if deferred_radios != \{"wifi", "data"\}:/);
 const enable=runner.indexOf('base.adb = preserve_debug_metro_radios');
 const run=runner.indexOf('semantic.run_lab()',enable);
 const restore=runner.indexOf('base.adb = original_adb',run);
 assert.ok(enable>=0 && run>enable && restore>run,'radio interception is restricted to the synthetic Debug run');
 assert.match(runner,/base\.chooser_present = original_chooser/);
 assert.match(runner,/base\.wait_visible = original_wait_visible/);
 assert.doesNotMatch(runner,/adb\("shell", "svc", "wifi", "enable"|adb\("shell", "svc", "data", "enable"|settings put global http_proxy/i);
});
