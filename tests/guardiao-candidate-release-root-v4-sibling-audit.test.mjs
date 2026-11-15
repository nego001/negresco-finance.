import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const py=readFileSync('tooling/android/guardiao_candidate_release_root_v4_api28_sibling_audit_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-candidate-release-root-v4-sibling-audit-api28.yml','utf8');
test('audit is passive, pins v4 APK and preserves blocked original classification',()=>{
 assert.match(workflow,/run-id: 43772274643/);
 assert.match(workflow,/scenario: \[home_only\]/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/CN=Android Debug/);
 assert.match(workflow,/3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6/);
 assert.match(py,/if first!=second or second!=VALID:/);
 assert.match(py,/sibling_inventory\(BASE\.xml_nodes\(\),width,height\)/);
 assert.match(py,/home\.observed_single_app_pid\(\)!=pid/);
 const executable=py.replace(/"""[\s\S]*?"""/g,'').replace(/^\s*#.*$/gm,'');
 assert.doesNotMatch(executable,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|print\(nodes\)|print\(pid\)|print\(result\)|screencap/);
 assert.doesNotMatch(workflow,/assembleRelease|assembleDebug|upload-artifact|workflow_dispatch|secrets\.|contents: write/i);
});
test('sibling inventory distinguishes duplicate content labels from unique bounded bottom tabs',()=>{
 const code=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_candidate_release_root_v4_api28_sibling_audit_lab as x',
 'W,H=1080,2400',
 'def node(name,bounds,parent,clickable=False):',
 ' return {"class":"android.widget.TextView" if not clickable else "android.view.ViewGroup","text":name if not clickable else "","enabled":"true","package":"com.negresco.finance","bounds":bounds,"_tap_bounds":parent,"clickable":"true" if clickable else "false"}',
 'def tab(name,bounds,label):',
 ' return [node("",bounds,bounds,True),node(name,label,bounds)]',
 'a=tab("Início","[40,2100][340,2230]","[120,2130][230,2190]")',
 'b=tab("Pix","[390,2100][690,2230]","[480,2130][570,2190]")',
 'c=tab("Negresco","[740,2100][1040,2230]","[800,2130][970,2190]")',
 'quick=tab("Pix","[40,760][340,900]","[120,800][220,850]")',
 'd=x.sibling_inventory(a+b+c+quick,W,H)',
 'assert d["Pix"]==("multiple","multiple","one"),d',
 'assert d["Negresco"]==("one","one","one"),d',
 'missing=x.sibling_inventory(a+b,W,H)',
 'assert missing["Negresco"]==("none","none","none")',
 'twice=x.sibling_inventory(a+b+b+c,W,H)',
 'assert twice["Pix"]==("multiple","multiple","multiple")',
 'print("PASS: passive sibling inventory strict labels and parent geometry")'
 ].join('\n');
 const result=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/PASS: passive sibling inventory strict labels and parent geometry/);
});
