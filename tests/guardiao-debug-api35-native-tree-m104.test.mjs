import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-overlap-subtree-m103.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-native-tree-m104.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_native_tree_m104.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_NATIVE_TREE_M104.md','utf8');
test('M104 exact M103 workflow except names refs source prep and runtime API scope',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug API35 overlap subtree M103","Guardiao Debug API35 native tree M104"],["lab/p01-guardiao-debug-api35-overlap-subtree-m103-v1","lab/p01-guardiao-debug-api35-native-tree-m104-v1"],["guardiao-debug-api35-overlap-subtree-m103-","guardiao-debug-api35-native-tree-m104-"],["M103 API ${{ matrix.api }} - overlap subtree","M104 API ${{ matrix.api }} - native tree"],["Apply exact M102 control plus common subtree diagnostic","Apply exact M103 control plus blocked native tree diagnostic"],["guardiao_debug_api35_overlap_subtree_m103.py apply","guardiao_debug_api35_native_tree_m104.py apply"],["      - name: Verify unchanged guarded Pix cycles on selected Android API\n        uses:","      - name: Verify unchanged guarded Pix cycles on selected Android API\n        env:\n          M93_EXPECTED_API: ${{ matrix.api }}\n        uses:"]]) {
   assert.equal(expected.split(a).length,2,a);
   expected=expected.replace(a,b);
 }
 assert.equal(current,expected);
 assert.ok(patch.includes('LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-native-tree-m104-v1"'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_native_tree_m104 as m',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M104 exact reversible post-block only hook retains original rejection',()=>run([
 'orig=m.NAV.read_text(encoding="utf-8")',
 'out=m.nav_transform(orig)',
 'ast.parse(out)',
 'assert out.replace(m.NEW,m.OLD)==orig',
 'assert m.NEW.endswith(\'raise RuntimeError("unsafe Pix candidate")\')',
 'assert out.count("guarded_preview_tap(")==orig.count("guarded_preview_tap(")',
 'for bad in ("",orig+orig,out):',
 ' try: m.nav_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M104 native hierarchy rejects ambiguity and only emits fixed class candidates',()=>run([
 'lines=["ACTIVITY com.negresco.finance/.MainActivity abc pid=123","  View Hierarchy:","    DecorView@abc[MainActivity]","      android.widget.FrameLayout{abc V.E...... ........ 0,0-100,200}","        com.facebook.react.views.view.ReactViewGroup{def V.E...C.. ........ 0,0-50,60}","      android.widget.LinearLayout{aaa V.E...... ........ 0,0-90,190}","        private.fixture.View{bbb V.E...C.. ........ 0,0-50,60}","  Other state:"]',
 'raw="\\n".join(lines)',
 'assert m.classify_native(raw,(50,60),(100,200))==("unique-size-pair-candidate","react-viewgroup","android-frame")',
 'assert m.classify_native(raw,(50,60),(90,190))==("unique-size-pair-candidate","other-class","android-linear")',
 'assert m.classify_native(raw,(40,60),(100,200))[0]=="no-size-match"',
 'assert m.classify_native(raw,(50,60),(80,180))[0]=="no-parent-size-match"',
 'assert m.classify_native(raw+raw,(50,60),(100,200))[0]=="activity-unconfirmed" or m.classify_native(raw+"\\n"+raw,(50,60),(100,200))[0]=="activity-unconfirmed"',
 'extra=lines[:5]+[lines[4].replace("{def","{abc")]+lines[5:]',
 'assert m.classify_native("\\n".join(extra),(50,60),(100,200))[0]=="ambiguous-pair"',
 'assert m.parse_native(raw.replace("DecorView@abc","bad"))[0]=="decor-unconfirmed"',
 'assert m.parse_native(raw.replace("V.E...C..","invalid"))[0]=="view-format-unconfirmed"'
]));
test('M104 one read only after scope snapshot and process gates with no retry',()=>run([
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
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "124")',
 'os.environ["GITHUB_REF"]="refs/heads/main"',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert len(calls)==1'
]));
test('M104 preserves M103 evidence and production gates',()=>{
 for(const x of ['M103','1,805/1,805','outside-anchor-subtree-shared-ancestor','different-depth-or-parent','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
