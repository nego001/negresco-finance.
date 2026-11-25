import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-view-format-m106.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-native-probe-m107.yml','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_native_probe_m107.py','utf8');
const kt=readFileSync('tooling/android/fixtures/GuardiaoNativeProbeM107.kt','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_NATIVE_PROBE_M107.md','utf8');
test('M107 exact M106 workflow except names refs and scoped native install',()=>{
 let expected=old;
 for(const [a,b] of [["Guardiao Debug API35 view format M106","Guardiao Debug API35 native probe M107"],["lab/p01-guardiao-debug-api35-view-format-m106-v1","lab/p01-guardiao-debug-api35-native-probe-m107-v1"],["guardiao-debug-api35-view-format-m106-","guardiao-debug-api35-native-probe-m107-"],["M106 API ${{ matrix.api }} - view format","M107 API ${{ matrix.api }} - native probe"],["Apply exact M105 native tree with view format categories","Apply exact M106 control plus native probe reader"],["guardiao_debug_api35_view_format_m106.py apply","guardiao_debug_api35_native_probe_m107.py apply"],["      - name: Remove denied permissions from disposable Debug manifest overlay","      - name: Install private native probe in disposable MainActivity\n        env:\n          M93_EXPECTED_API: ${{ matrix.api }}\n        run: |\n          set -euo pipefail\n          python3 tooling/android/guardiao_debug_api35_native_probe_m107.py install\n      - name: Remove denied permissions from disposable Debug manifest overlay"]]) {assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(current,expected);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_native_probe_m107 as m',
 'import guardiao_debug_api35_view_format_m106 as p',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M107 exact reversible activity and navigation hooks preserve rejection',()=>run([
 'orig=m.NAV.read_text(encoding="utf-8")',
 'out=m.nav_transform(orig)',
 'ast.parse(out)',
 'assert out.replace(m.NEW,m.OLD)==orig',
 'assert out.replace("guardiao_debug_api35_native_probe_m107","guardiao_debug_api35_view_format_m106")==p.nav_transform(orig)',
 'source="package com.negresco.finance\\nclass MainActivity : ReactActivity() {\\n}"',
 'changed=m.activity_transform(source)',
 'assert changed.replace(m.ANCHOR+"\\n"+m.HOOK,m.ANCHOR)==source',
 'for bad in ("",source+source,changed):',
 ' try: m.activity_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M107 fixed probe marker scoped to one app activity and exact private dimension match',()=>run([
 'start="ACTIVITY com.negresco.finance/.MainActivity abc pid=123\\n"',
 'marker="  NEGRESCO_LAB_M107_NATIVE unique-native-candidate react-viewgroup android-frame 50 60 100 200"',
 'sizes=((50,60),(100,200))',
 'assert m.classify_probe(start+marker,sizes)==("unique-geometry-pair-candidate","react-viewgroup","android-frame")',
 'assert m.classify_probe(start+marker,((51,60),(100,200)))[0]=="geometry-mismatch"',
 'assert m.classify_probe(start+marker+"\\n"+marker,sizes)[0]=="marker-unconfirmed"',
 'assert m.classify_probe(start+"ACTIVITY com.other/.MainActivity abc\\n"+marker,sizes)[0]=="marker-unconfirmed"',
 'assert m.classify_probe(start+marker.replace("react-viewgroup","private.class"),sizes)[0]=="marker-unconfirmed"',
 'assert m.classify_probe(start+"NEGRESCO_LAB_M107_NATIVE anchors-unconfirmed",sizes)[0]=="anchors-unconfirmed"'
]));
test('M107 retains one read, scope and native helper privacy boundaries',()=> {
 for(const x of ['BuildConfig.DEBUG','Build.VERSION.SDK_INT != 35','Looper.myLooper()','hasWindowFocus()','getGlobalVisibleRect','react_test_id','groups.any { it.size != 1 }','hits.size != 1','writer.println(prefix + MARKER + value)']) assert.ok(kt.includes(x),x);
 for(const x of ['performClick(', 'dispatchTouchEvent(', 'Log.', 'getText(', 'contentDescription', 'setOnClickListener', 'SharedPreferences']) assert.ok(!kt.includes(x),x);
 run([
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
 'assert "m107-native=response-unconfirmed" in stream.getvalue()',
 'os.environ["GITHUB_REF"]=p.LAB_REF',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert len(calls)==1'
 ]);
});
test('M107 preserves M106 evidence and production gates',()=>{
 for(const x of ['M106','1,818/1,818','view-prefix-unconfirmed','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
});
