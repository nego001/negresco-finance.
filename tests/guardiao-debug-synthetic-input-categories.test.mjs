import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const releaseSmoke=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');
const synthetic=[
'import ast',
'from pathlib import Path',
'source=Path("tooling/android/guardiao_pdf_debug_metro_lab.py").read_text()',
'tree=ast.parse(source)',
'fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="classify_debug_synthetic_input_node")',
'ns={}',
'exec(compile(ast.Module(body=[fn],type_ignores=[]),"<synthetic>","exec"),ns)',
'f=ns["classify_debug_synthetic_input_node"]',
'line="8"+"0"*47',
'node=lambda value,cls="android.widget.EditText",label="Linha digitável do boleto": {"class":cls,"content-desc":label,"text":value}',
'assert f(node(line),[node(line)],line)=="synthetic-selected-value-matched"',
'assert f(node(""),[node(line)],line)=="synthetic-value-in-other-edittext"',
'assert f(node(""),[],line)=="synthetic-edittext-not-observed"',
'assert f(node(""),[node("")],line)=="synthetic-edittext-empty"',
'assert f(node(""),[node("partial")],line)=="synthetic-edittext-nonempty-mismatch"',
'assert f(node(""),[node(line,"android.widget.TextView")],line)=="synthetic-edittext-not-observed"',
'assert f(node(""),[node(line,"android.widget.EditText","another-input")],line)=="synthetic-edittext-not-observed"',
'assert f(node(""),[node("partial")],line)!="synthetic-selected-value-matched"',
'print("PASS: synthetic input categories are fixed and do not contain values")',
].join('\n');

test('Android Debug synthetic field is classified from allowlisted metadata only',()=>{
 const r=spawnSync('python3',['-c',synthetic],{encoding:'utf8',timeout:12000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: synthetic input categories are fixed and do not contain values');
});

test('diagnosis cannot bypass strict Release/shared fixture validation',()=>{
 assert.match(releaseSmoke,/if populated\.get\("text", ""\) != FIXTURE:\s+raise RuntimeError\("synthetic input was not populated in the EditText"\)/);
 const conditional='if needle == "Linha digitável do boleto" and retries == 10:';
 assert.ok(runner.includes(conditional));
 const pos=runner.indexOf(conditional);
 const end=runner.indexOf('if needle != "Seu universo"',pos);
 const local=runner.slice(pos,end);
 assert.ok(pos>=0 && end>pos);
 assert.match(local,/base\.xml_nodes\(\)/);
 assert.match(local,/select_verified_debug_synthetic_edittext\(/);
 assert.match(local,/classify_debug_synthetic_input_node/);
 assert.match(local,/return verified/);
 assert.match(local,/return field/);
 assert.doesNotMatch(local,/adb\("shell", "input"|print\([^)]*(?:FIXTURE|field\[|node\[|base\.xml_nodes)/i);
 assert.match(runner,/if not observed:\s+raise RuntimeError\("no actual debug-only phase marker was observed"\)/);
 assert.match(runner,/nativePdfSemanticTextVerified/);
 assert.match(runner,/receiverCacheClean/);
});
