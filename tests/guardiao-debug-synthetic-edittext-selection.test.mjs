import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const shared=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');

const py=[
'import ast',
'from pathlib import Path',
'program=ast.parse(Path("tooling/android/guardiao_pdf_debug_metro_lab.py").read_text())',
'fn=next(x for x in program.body if isinstance(x,ast.FunctionDef) and x.name=="select_verified_debug_synthetic_edittext")',
'ns={}',
'exec(compile(ast.Module(body=[fn],type_ignores=[]),"<contract>","exec"),ns)',
'select=ns["select_verified_debug_synthetic_edittext"]',
'fixed="8"+"0"*47',
'def field(value, cls="android.widget.EditText", desc="Linha digitável do boleto"):',
'    return {"class":cls,"content-desc":desc,"text":value}',
'label={"class":"android.widget.TextView","text":"Linha digitável do boleto","content-desc":""}',
'valid=field(fixed)',
'assert select(label,[label,valid],fixed) is valid',
'assert select(valid,[label,valid],fixed) is valid',
'assert select(label,[label,field("")],fixed) is label',
'assert select(label,[label,field("partial")],fixed) is label',
'assert select(label,[label,valid,field(fixed)],fixed) is label',
'assert select(label,[label,valid,field("partial")],fixed) is label',
'assert select(label,[field(fixed,"android.widget.TextView")],fixed) is label',
'assert select(label,[field(fixed,"android.widget.EditText","another-input")],fixed) is label',
'assert select(label,[valid],("0"*47)) is label',
'assert select(label,[valid],("0"*48)) is label',
'assert select(label,[],fixed) is label',
'print("PASS: only unique exact, accessible, synthetic EditText can be returned")',
].join('\n');

test('the fixed synthetic input selects only a unique matching EditText',()=>{
 const p=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:10000});
 assert.equal(p.status,0,p.stderr);
 assert.equal(p.stdout.trim(),'PASS: only unique exact, accessible, synthetic EditText can be returned');
});

test('only Debug fixture confirmation uses the selector; Release remains strict',()=>{
 const conditional=source.indexOf('if needle == "Linha digitável do boleto" and retries == 10:');
 const actual=source.indexOf('select_verified_debug_synthetic_edittext(',conditional);
 const verified=source.indexOf('return verified',actual);
 assert.ok(conditional>=0 && actual>conditional && verified>actual);
 assert.match(source,/if len\(fixture\) != 48 or fixture != "8" \+ "0" \* 47:/);
 assert.match(source,/if len\(candidates\) == 1 and candidates\[0\]\.get\("text"\) == fixture:/);
 assert.match(source,/synthetic-edittext-exact-verified/);
 assert.match(shared,/populated = wait_visible\("Linha digitável do boleto", retries=10\)/);
 assert.match(shared,/if populated\.get\("text", ""\) != FIXTURE:\s+raise RuntimeError\("synthetic input was not populated in the EditText"\)/);
 assert.doesNotMatch(source.slice(conditional,source.indexOf('if needle != "Seu universo"',conditional)),/adb\("shell", "input"|adb\("shell", "svc"|print\([^)]*(?:fixture|FIXTURE|node\[|field\[)/i);
});
