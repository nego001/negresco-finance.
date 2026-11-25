import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-native-tree-m104.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-decor-format-m105.yml','utf8');
const oldScript=readFileSync('tooling/android/guardiao_debug_api35_native_tree_m104.py','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_decor_format_m105.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_DECOR_FORMAT_M105.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M105 exact M104 workflow and source except bounded decor format and branch names',()=>{
 assert.equal(current,apply(old,[["Guardiao Debug API35 native tree M104","Guardiao Debug API35 decor format M105"],["lab/p01-guardiao-debug-api35-native-tree-m104-v1","lab/p01-guardiao-debug-api35-decor-format-m105-v1"],["guardiao-debug-api35-native-tree-m104-","guardiao-debug-api35-decor-format-m105-"],["M104 API ${{ matrix.api }} - native tree","M105 API ${{ matrix.api }} - decor format"],["Apply exact M103 control plus blocked native tree diagnostic","Apply exact M104 native tree with decor format extension"],["guardiao_debug_api35_native_tree_m104.py apply","guardiao_debug_api35_decor_format_m105.py apply"]]));
 assert.equal(patch,apply(oldScript,[["M104: one native view hierarchy read after existing pre-Pix BLOCK.","M105: exact M104 native read with bounded DecorView format extension."],["lab/p01-guardiao-debug-api35-native-tree-m104-v1","lab/p01-guardiao-debug-api35-decor-format-m105-v1"],["from guardiao_debug_api35_native_tree_m104 import report_after_block","from guardiao_debug_api35_decor_format_m105 import report_after_block"],["def parse_native(raw):","def recognized_decor(line):\n    \"\"\"Accept only legacy header or exact full AOSP DecorView and MainActivity suffix.\"\"\"\n    if DECOR.fullmatch(line):\n        return True\n    suffix = \"[MainActivity]\"\n    if not line.endswith(suffix):\n        return False\n    view = VIEW.fullmatch(line.removesuffix(suffix))\n    return view is not None and view.group(\"class\") == \"com.android.internal.policy.DecorView\"\n\n\ndef parse_native(raw):"],["not DECOR.fullmatch(root.strip())","not recognized_decor(root.strip())"],["M104 exact API35 required","M105 exact API35 required"],["unrecognized M104 branch","unrecognized M105 branch"],["M104 exact M103 control plus blocked native tree diagnostic","M105 exact M104 native tree with decor format extension"],["M104 scoped native tree diagnostic not attested","M105 scoped decor format not attested"]]));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_decor_format_m105 as m',
 'import guardiao_debug_api35_native_tree_m104 as p',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M105 accepts only legacy or exact AOSP full DecorView MainActivity header',()=>run([
 'legacy="DecorView@abc[MainActivity]"',
 'full="com.android.internal.policy.DecorView{abc V.E...... ........ 0,0-100,200}[MainActivity]"',
 'assert m.recognized_decor(legacy) and m.recognized_decor(full)',
 'for bad in (full.replace("MainActivity","OtherActivity"),full.replace("com.android.internal.policy.","private."),full.replace("V.E......","invalid"),full+" extra",legacy.replace("MainActivity","OtherActivity"),"MainActivity"):',
 ' assert not m.recognized_decor(bad)',
 'lines=["ACTIVITY com.negresco.finance/.MainActivity abc pid=123","  View Hierarchy:","    "+legacy,"      android.widget.FrameLayout{abc V.E...... ........ 0,0-100,200}","        com.facebook.react.views.view.ReactViewGroup{def V.E...C.. ........ 0,0-50,60}","  Other state:"]',
 'raw="\\n".join(lines)',
 'expected=("unique-size-pair-candidate","react-viewgroup","android-frame")',
 'assert m.classify_native(raw,(50,60),(100,200))==p.classify_native(raw,(50,60),(100,200))==expected',
 'modern=raw.replace(legacy,full)',
 'assert p.parse_native(modern)[0]=="decor-unconfirmed"',
 'assert m.classify_native(modern,(50,60),(100,200))==expected',
 'assert m.parse_native(modern.replace("MainActivity]","OtherActivity]"))[0]=="decor-unconfirmed"',
 'assert m.parse_native(modern.replace("    "+full,"  "+full))[0]=="decor-unconfirmed"',
 'assert m.parse_native(modern.replace("com.facebook.react.views.view.ReactViewGroup{def","bad line {def"))[0]=="view-format-unconfirmed"'
]));
test('M105 exact original post-block guard and single native read retained',()=>run([
 'orig=m.NAV.read_text(encoding="utf-8")',
 'out=m.nav_transform(orig)',
 'ast.parse(out)',
 'assert out.replace(m.NEW,m.OLD)==orig',
 'assert out.replace("guardiao_debug_api35_decor_format_m105","guardiao_debug_api35_native_tree_m104")==p.nav_transform(orig)',
 'import guardiao_api28_debug_external_a11y_readonly_lab as observer',
 'calls=[]',
 'observer.debug_pid=lambda:"123"',
 'observer.debug_focus=lambda:True',
 'observer.BASE.adb=lambda *args,**kwargs: calls.append((args,kwargs)) or ""',
 'm.private_sizes=lambda nodes: ((50,60),(100,200))',
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF=m.LAB_REF,M93_EXPECTED_API="35")',
 'stream=io.StringIO()',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert calls==[(("shell","dumpsys","activity","top"),{"timeout":22})]',
 'assert "m104-native=response-unconfirmed" in stream.getvalue()',
 'os.environ["GITHUB_REF"]=p.LAB_REF',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert len(calls)==1'
]));
test('M105 preserves M104 evidence and production gates',()=>{
 for(const x of ['M104','1,810/1,810','decor-unconfirmed','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
