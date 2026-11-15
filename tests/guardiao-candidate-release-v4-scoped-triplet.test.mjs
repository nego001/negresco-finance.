import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const lab=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_triplet_api28_lab.py','utf8');
const wf=readFileSync('.github/workflows/guardiao-candidate-release-v4-scoped-triplet-api28.yml','utf8');

test('v4 new geometry proof is pinned, passive and separate from legacy Home and PDF gates',()=>{
 assert.match(wf,/run-id: 43772274643/);
 assert.match(wf,/3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6/);
 assert.match(wf,/CN=Android Debug/);
 assert.match(wf,/api-level: 28/);
 assert.match(wf,/persist-credentials: false/);
 assert.match(wf,/scenario: \[home_only\]/);
 assert.match(lab,/candidate\.candidate_identity\(candidate\.APK\)/);
 assert.match(lab,/home\.observed_single_app_pid\(\) != pid/);
 assert.match(lab,/scoped_triplet_category\(BASE\.xml_nodes\(\), width, height\)/);
 assert.match(lab,/if first != PASS or second != PASS:/);
 const executable=lab.replace(/"""[\s\S]*?"""/g,'').replace(/^\s*#.*$/gm,'');
 assert.doesNotMatch(executable,/input", "tap"|input", "swipe"|force-stop|pm", "clear"|screencap|print\(nodes\)|print\(pid\)/);
 assert.doesNotMatch(wf,/assembleRelease|assembleDebug|upload-artifact|workflow_dispatch|secrets\.|contents: write/i);
});

test('scoped triplet rejects ambiguous, overlapping and detached Android UI descendants',()=>{
 const script=[
 "import sys",
 "sys.path.insert(0,'tooling/android')",
 "import guardiao_candidate_release_v4_scoped_triplet_api28_lab as t",
 "W,H=1080,2400",
 "def node(name,bounds,parent,clickable=False,pkg='com.negresco.finance'):",
 " return {'class':'android.view.ViewGroup' if clickable else 'android.widget.TextView','text':'' if clickable else name,'enabled':'true','package':pkg,'bounds':bounds,'_tap_bounds':parent,'clickable':'true' if clickable else 'false'}",
 "def tab(name,bounds,label):",
 " return [node('',bounds,bounds,True),node(name,label,bounds)]",
 "a=tab('Início','[40,2100][340,2230]','[120,2130][230,2190]')",
 "b=tab('Pix','[390,2100][690,2230]','[480,2130][570,2190]')",
 "c=tab('Negresco','[740,2100][1040,2230]','[800,2130][970,2190]')",
 "shortcut=tab('Pix','[40,760][340,900]','[120,800][220,850]')",
 "base=a+b+c+shortcut",
 "assert t.scoped_triplet_category(base,W,H)==t.PASS",
 "assert t.scoped_triplet_category(a+b+c,W,H)==t.PASS",
 "assert t.scoped_triplet_category(a+b+c+b,W,H)=='bottom-label-not-unique'",
 "assert t.scoped_triplet_category(a+b,W,H)=='bottom-label-not-unique'",
 "overlap=tab('Pix','[280,2100][630,2230]','[380,2130][540,2190]')",
 "assert t.scoped_triplet_category(a+overlap+c,W,H)=='horizontal-overlap-or-order'",
 "misorder=tab('Pix','[720,2100][1040,2230]','[780,2130][950,2190]')",
 "assert t.scoped_triplet_category(a+misorder+c,W,H)!='scoped-three-tabs-verified'",
 "off=tab('Pix','[390,2340][690,2460]','[480,2350][570,2390]')",
 "assert t.scoped_triplet_category(a+off+c,W,H)!='scoped-three-tabs-verified'",
 "no_parent=a+[b[1]]+c",
 "assert t.scoped_triplet_category(no_parent,W,H)=='clickable-parent-not-unique'",
 "foreign=tab('Pix','[390,2100][690,2230]','[480,2130][570,2190]')",
 "foreign[1]['package']='other.package'",
 "assert t.scoped_triplet_category(a+foreign+c,W,H)=='bottom-label-not-unique'",
 "coincident=a+b+c+[node('',b[0]['bounds'],b[0]['bounds'],True)]",
 "assert t.scoped_triplet_category(coincident,W,H)=='clickable-parent-not-unique'",
 "overlay=a+b+c+[node('', '[400,2120][670,2210]', '[400,2120][670,2210]',True)]",
 "assert t.scoped_triplet_category(overlay,W,H)=='parent-center-overlapped'",
 "assert t.scoped_triplet_category([],W,H)=='home-not-bounded'",
 "assert t.scoped_triplet_category(None,W,H)=='invalid-input'",
 "print('PASS: strict scoped triplet proof synthetic matrix')"
 ].join('\n');
 const p=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: strict scoped triplet proof synthetic matrix/);
});
