import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-native-probe-m107.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-safearea-warning-m108.yml','utf8');
const oldScript=readFileSync('tooling/android/guardiao_debug_api35_native_probe_m107.py','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_safearea_warning_m108.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_SAFEAREA_WARNING_M108.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M108 exact M107 workflow and source except one warning filter and lab identity',()=>{
 assert.equal(current,apply(old,[["Guardiao Debug API35 native probe M107","Guardiao Debug API35 safearea warning M108"],["lab/p01-guardiao-debug-api35-native-probe-m107-v1","lab/p01-guardiao-debug-api35-safearea-warning-m108-v1"],["guardiao-debug-api35-native-probe-m107-","guardiao-debug-api35-safearea-warning-m108-"],["M107 API ${{ matrix.api }} - native probe","M108 API ${{ matrix.api }} - safearea warning"],["Apply exact M106 control plus native probe reader","Apply exact M107 control plus targeted warning filter"],["guardiao_debug_api35_native_probe_m107.py apply","guardiao_debug_api35_safearea_warning_m108.py apply"],["guardiao_debug_api35_native_probe_m107.py install","guardiao_debug_api35_safearea_warning_m108.py install"]]));
 assert.equal(patch,apply(oldScript,[["M107: native Debug-only direct View census via existing post-block dump.","M108: targeted SafeAreaView warning-filter experiment, Debug only."],["lab/p01-guardiao-debug-api35-native-probe-m107-v1","lab/p01-guardiao-debug-api35-safearea-warning-m108-v1"],["from guardiao_debug_api35_native_probe_m107 import report_after_block","from guardiao_debug_api35_safearea_warning_m108 import report_after_block"],["def apply():","APP_ANCHOR = \"type Page = 'Início' | 'Pix'\"\nWARNING_ONLY = \"import { LogBox } from 'react-native';\\n\\nif (__DEV__) {\\n  LogBox.ignoreLogs(['SafeAreaView has been deprecated and will be removed in a future release.']);\\n}\\n\\n\"\n\ndef app_transform(source):\n    control = m91_pure(source)\n    if control.count(APP_ANCHOR) != 1 or WARNING_ONLY in control or \"LogBox.ignore\" in control:\n        raise RuntimeError(\"unexpected warning filter source\")\n    out = control.replace(APP_ANCHOR, WARNING_ONLY + APP_ANCHOR)\n    if out.replace(WARNING_ONLY + APP_ANCHOR, APP_ANCHOR) != control:\n        raise RuntimeError(\"nonisolated warning filter\")\n    return out\n\ndef apply():"],["m91_pure(APP.read_text(encoding=\"utf-8\"))","app_transform(APP.read_text(encoding=\"utf-8\"))"],["M107 scope required","M108 scope required"],["unrecognized M107 scope","unrecognized M108 scope"],["M107 exact M106 control plus native probe reader","M108 exact M107 control plus targeted warning filter"],["M107 disposable Debug activity probe installed","M108 disposable Debug activity probe installed"],["M107 scoped native probe not attested","M108 scoped warning experiment not attested"]]));
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_safearea_warning_m108 as m',
 'import guardiao_debug_api35_native_probe_m107 as p',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M108 one targeted Debug warning filter is reversible without layout changes',()=>run([
 'source=m.APP.read_text(encoding="utf-8")',
 'control=p.m91_pure(source)',
 'out=m.app_transform(source)',
 'assert out.replace(m.WARNING_ONLY+m.APP_ANCHOR,m.APP_ANCHOR)==control',
 'assert out.count("LogBox.ignoreLogs(")==1',
 'assert "if (__DEV__)" in m.WARNING_ONLY',
 'assert "SafeAreaView has been deprecated and will be removed in a future release." in m.WARNING_ONLY',
 'assert "ignoreAllLogs" not in out',
 'assert "console.warn =" not in out',
 'for bad in ("",source+source,out):',
 ' try: m.app_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M108 retains exact native probe and original guard even if warning persists',()=>run([
 'orig=m.NAV.read_text(encoding="utf-8")',
 'out=m.nav_transform(orig)',
 'ast.parse(out)',
 'assert out.replace(m.NEW,m.OLD)==orig',
 'assert out.replace("guardiao_debug_api35_safearea_warning_m108","guardiao_debug_api35_native_probe_m107")==p.nav_transform(orig)',
 'assert m.FIXTURE==p.FIXTURE and m.HOOK==p.HOOK',
 'assert m.subtree_transform is p.subtree_transform and m.xml_transform is p.xml_transform',
 'start="ACTIVITY com.negresco.finance/.MainActivity abc pid=123\\n"',
 'marker="  NEGRESCO_LAB_M107_NATIVE unique-native-candidate react-viewgroup react-viewgroup 50 60 100 200"',
 'sizes=((50,60),(100,200))',
 'assert m.classify_probe(start+marker,sizes)==p.classify_probe(start+marker,sizes)==("unique-geometry-pair-candidate","react-viewgroup","react-viewgroup")',
 'import guardiao_api28_debug_external_a11y_readonly_lab as observer',
 'calls=[]',
 'observer.debug_pid=lambda:"123"',
 'observer.debug_focus=lambda:True',
 'observer.BASE.adb=lambda *args,**kwargs: calls.append((args,kwargs)) or ""',
 'm.private_sizes=lambda nodes: sizes',
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF=m.LAB_REF,M93_EXPECTED_API="35")',
 'stream=io.StringIO()',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert calls==[(("shell","dumpsys","activity","top"),{"timeout":22})]',
 'os.environ["GITHUB_REF"]=p.LAB_REF',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert len(calls)==1'
]));
test('M108 preserves M107 evidence and production gates',()=>{
 for(const x of ['M107','1,823/1,823','unique-geometry-pair-candidate','react-viewgroup','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
});
