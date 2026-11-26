import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
import {originalManifest} from './helpers/guardiao_dependency_state_m143.mjs';
historicalAppPath();
originalManifest();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-safearea-warning-m108.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-root-view-m109.yml','utf8');
const oldScript=readFileSync('tooling/android/guardiao_debug_api35_safearea_warning_m108.py','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_root_view_m109.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_ROOT_VIEW_M109.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M109 exact M108 workflow and source except root replacement and lab identity',()=>{
 assert.equal(current,apply(old,[["Guardiao Debug API35 safearea warning M108","Guardiao Debug API35 root view M109"],["lab/p01-guardiao-debug-api35-safearea-warning-m108-v1","lab/p01-guardiao-debug-api35-root-view-m109-v1"],["guardiao-debug-api35-safearea-warning-m108-","guardiao-debug-api35-root-view-m109-"],["M108 API ${{ matrix.api }} - safearea warning","M109 API ${{ matrix.api }} - root view"],["Apply exact M107 control plus targeted warning filter","Apply exact M107 control plus Android root View replacement"],["guardiao_debug_api35_safearea_warning_m108.py apply","guardiao_debug_api35_root_view_m109.py apply"],["guardiao_debug_api35_safearea_warning_m108.py install","guardiao_debug_api35_root_view_m109.py install"]]));
 assert.equal(patch,apply(oldScript,[["M108: targeted SafeAreaView warning-filter experiment, Debug only.","M109: replace legacy Android root with View, no warning filter."],["lab/p01-guardiao-debug-api35-safearea-warning-m108-v1","lab/p01-guardiao-debug-api35-root-view-m109-v1"],["from guardiao_debug_api35_safearea_warning_m108 import report_after_block","from guardiao_debug_api35_root_view_m109 import report_after_block"],["APP_ANCHOR = \"type Page = 'Início' | 'Pix'\"\nWARNING_ONLY = \"import { LogBox } from 'react-native';\\n\\nif (__DEV__) {\\n  LogBox.ignoreLogs(['SafeAreaView has been deprecated and will be removed in a future release.']);\\n}\\n\\n\"\n\ndef app_transform(source):\n    control = m91_pure(source)\n    if control.count(APP_ANCHOR) != 1 or WARNING_ONLY in control or \"LogBox.ignore\" in control:\n        raise RuntimeError(\"unexpected warning filter source\")\n    out = control.replace(APP_ANCHOR, WARNING_ONLY + APP_ANCHOR)\n    if out.replace(WARNING_ONLY + APP_ANCHOR, APP_ANCHOR) != control:\n        raise RuntimeError(\"nonisolated warning filter\")\n    return out\n\n","ROOT_PAIRS = [[\"Easing, SafeAreaView, ScrollView\",\"Easing, ScrollView\"],[\"React.ElementRef<typeof SafeAreaView>|null\",\"React.ElementRef<typeof View>|null\"],[\"return <SafeAreaView ref={__DEV__?labWindowRoot:undefined}\",\"return <View ref={__DEV__?labWindowRoot:undefined}\"],[\"  </SafeAreaView>;\\n}\\nconst s=StyleSheet.create({\",\"  </View>;\\n}\\nconst s=StyleSheet.create({\"]]\n\ndef app_transform(source):\n    control = m91_pure(source)\n    if \"LogBox.ignore\" in control or control.count(\"SafeAreaView\") != 4:\n        raise RuntimeError(\"unexpected legacy root source\")\n    out = control\n    for old,new in ROOT_PAIRS:\n        if out.count(old) != 1:\n            raise RuntimeError(\"root replacement anchor unconfirmed\")\n        out = out.replace(old,new)\n    if \"SafeAreaView\" in out or \"LogBox.ignore\" in out:\n        raise RuntimeError(\"unexpected warning suppression or remaining legacy root\")\n    restored = out\n    for old,new in reversed(ROOT_PAIRS):\n        if restored.count(new) != 1:\n            raise RuntimeError(\"root replacement reverse anchor unconfirmed\")\n        restored = restored.replace(new,old)\n    if restored != control:\n        raise RuntimeError(\"nonisolated root replacement\")\n    return out\n\n"],["M108 scope required","M109 scope required"],["unrecognized M108 scope","unrecognized M109 scope"],["M108 exact M107 control plus targeted warning filter","M109 exact M107 control plus Android root View replacement"],["M108 disposable Debug activity probe installed","M109 disposable Debug activity probe installed"],["M108 scoped warning experiment not attested","M109 scoped root replacement not attested"]]));
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_root_view_m109 as m',
 'import guardiao_debug_api35_native_probe_m107 as p',
 'import guardiao_debug_api35_safearea_warning_m108 as q',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M109 Android root replacement is reversible and removes the deprecated import without suppressing warnings',()=>run([
 'source=__import__("pathlib").Path("tooling/android/fixtures/m139-historical-baseline/App.tsx").read_text(encoding="utf-8")',
 'control=p.m91_pure(source)',
 'out=m.app_transform(source)',
 'assert len(m.ROOT_PAIRS)==4',
 'restored=out',
 'for old,new in reversed(m.ROOT_PAIRS):',
 ' assert restored.count(new)==1',
 ' restored=restored.replace(new,old)',
 'assert restored==control',
 'assert "SafeAreaView" not in out and "LogBox.ignore" not in out',
 'assert q.WARNING_ONLY not in out',
 'assert "paddingBottom:(StatusBar.currentHeight??24)" in out',
 'assert "paddingTop:Platform.OS===" in out',
 'assert "return <View ref={__DEV__?labWindowRoot:undefined}" in out',
 'for bad in ("",source+source,out):',
 ' try: m.app_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M109 retains native probe and exact original guard rejection',()=>run([
 'orig=m.NAV.read_text(encoding="utf-8")',
 'out=m.nav_transform(orig)',
 'ast.parse(out)',
 'assert out.replace(m.NEW,m.OLD)==orig',
 'assert out.replace("guardiao_debug_api35_root_view_m109","guardiao_debug_api35_native_probe_m107")==p.nav_transform(orig)',
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
 'os.environ["GITHUB_REF"]=q.LAB_REF',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert len(calls)==1'
]));
test('M109 preserves M108 evidence and production gates',()=>{
 for(const x of ['M108','1,827/1,827','two guarded Home-Pix-Home Debug preview cycles','same PID','no PDF','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
});
