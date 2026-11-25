import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-root-view-matrix-m110.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-safe-insets-m111.yml','utf8');
const oldScript=readFileSync('tooling/android/guardiao_debug_root_view_matrix_m110.py','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_safe_insets_m111.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_SAFE_INSETS_M111.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M111 exact M110 matrix and scoped safe inset delta',()=>{
 assert.equal(current,apply(old,[["Guardiao Debug root view matrix M110","Guardiao Debug safe insets M111"],["lab/p01-guardiao-debug-root-view-matrix-m110-v1","lab/p01-guardiao-debug-safe-insets-m111-v1"],["guardiao-debug-root-view-matrix-m110-","guardiao-debug-safe-insets-m111-"],["M110 API ${{ matrix.api }} - root view matrix","M111 API ${{ matrix.api }} - safe insets"],["Apply exact M109 app with version-specific focus control","Apply M110 control plus measured safe insets"],["guardiao_debug_root_view_matrix_m110.py apply","guardiao_debug_safe_insets_m111.py apply"],["guardiao_debug_root_view_matrix_m110.py install","guardiao_debug_safe_insets_m111.py install"],["          npm install --no-audit --no-fund\n          npx tsc --noEmit","          npm install --no-audit --no-fund\n          node -e 'const b=require(\"expo/bundledNativeModules.json\"); const p=require(\"react-native-safe-area-context/package.json\"); if(b[\"react-native-safe-area-context\"]!==\"~5.6.0\" || p.version!==\"5.6.0\") process.exit(1); console.log(\"PASS (LAB): Expo SDK safe area dependency version attested\")'\n          npx tsc --noEmit"]]));
 assert.equal(patch,apply(oldScript,[["M110: exact M109 app across API28, API29, API35.","M111: measured safe insets over exact M110 Android Debug control."],["lab/p01-guardiao-debug-root-view-matrix-m110-v1","lab/p01-guardiao-debug-safe-insets-m111-v1"],["from guardiao_debug_root_view_matrix_m110 import report_after_block","from guardiao_debug_safe_insets_m111 import report_after_block"],["APIS = (","from guardiao_debug_root_view_matrix_m110 import app_transform as m110_app_transform\n\nAPIS = ("],["ROOT_PAIRS = [[\"Easing, SafeAreaView, ScrollView\",\"Easing, ScrollView\"],[\"React.ElementRef<typeof SafeAreaView>|null\",\"React.ElementRef<typeof View>|null\"],[\"return <SafeAreaView ref={__DEV__?labWindowRoot:undefined}\",\"return <View ref={__DEV__?labWindowRoot:undefined}\"],[\"  </SafeAreaView>;\\n}\\nconst s=StyleSheet.create({\",\"  </View>;\\n}\\nconst s=StyleSheet.create({\"]]\n\ndef app_transform(source):\n    control = m91_pure(source)\n    if \"LogBox.ignore\" in control or control.count(\"SafeAreaView\") != 4:\n        raise RuntimeError(\"unexpected legacy root source\")\n    out = control\n    for old,new in ROOT_PAIRS:\n        if out.count(old) != 1:\n            raise RuntimeError(\"root replacement anchor unconfirmed\")\n        out = out.replace(old,new)\n    if \"SafeAreaView\" in out or \"LogBox.ignore\" in out:\n        raise RuntimeError(\"unexpected warning suppression or remaining legacy root\")\n    restored = out\n    for old,new in reversed(ROOT_PAIRS):\n        if restored.count(new) != 1:\n            raise RuntimeError(\"root replacement reverse anchor unconfirmed\")\n        restored = restored.replace(new,old)\n    if restored != control:\n        raise RuntimeError(\"nonisolated root replacement\")\n    return out\n\n","PACKAGE = Path(\"apps/mobile/package.json\")\nPACKAGE_OLD = \"    \\\"react-native\\\": \\\"0.81.4\\\",\"\nPACKAGE_NEW = \"    \\\"react-native\\\": \\\"0.81.4\\\",\\n    \\\"react-native-safe-area-context\\\": \\\"5.6.0\\\",\"\nINSET_PAIRS = [[\"type Page = 'Início' | 'Pix'\",\"import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';\\n\\ntype Page = 'Início' | 'Pix'\"],[\"export default function App() {\\n  const [page,setPage]\",\"export default function App() {\\n  return <SafeAreaProvider initialMetrics={initialWindowMetrics} style={s.root}><AppContent/></SafeAreaProvider>;\\n}\\nfunction AppContent() {\\n  const insets=useSafeAreaInsets();\\n  const [page,setPage]\"],[\"{paddingTop:Platform.OS==='android'?(StatusBar.currentHeight??24):0},Platform.OS==='android'&&{paddingBottom:(StatusBar.currentHeight??24)}\",\"{paddingTop:insets.top,paddingBottom:insets.bottom,paddingLeft:insets.left,paddingRight:insets.right}\"],[\"const statusInset=StatusBar.currentHeight??0;\\n        edge=Number.isFinite(statusInset)&&statusInset>=0\\n          ?overflow<=statusInset+8\",\"const bottomInset=insets.bottom;\\n        edge=Number.isFinite(bottomInset)&&bottomInset>=0\\n          ?overflow<=bottomInset+8\"]]\n\ndef package_transform(source):\n    if source.count(PACKAGE_OLD)!=1 or \"react-native-safe-area-context\" in source:\n        raise RuntimeError(\"unexpected package dependency\")\n    out=source.replace(PACKAGE_OLD,PACKAGE_NEW)\n    if out.count(PACKAGE_NEW)!=1 or out.replace(PACKAGE_NEW,PACKAGE_OLD)!=source:\n        raise RuntimeError(\"nonisolated dependency\")\n    return out\n\ndef app_transform(source):\n    control=m110_app_transform(source)\n    if \"react-native-safe-area-context\" in control or \"LogBox.ignore\" in control:\n        raise RuntimeError(\"unexpected safe area control\")\n    out=control\n    for old,new in INSET_PAIRS:\n        if out.count(old)!=1:\n            raise RuntimeError(\"inset anchor unconfirmed\")\n        out=out.replace(old,new)\n    restored=out\n    for old,new in reversed(INSET_PAIRS):\n        if restored.count(new)!=1:\n            raise RuntimeError(\"reverse inset anchor unconfirmed\")\n        restored=restored.replace(new,old)\n    if restored!=control or \"StatusBar.currentHeight\" in out:\n        raise RuntimeError(\"nonisolated inset change\")\n    return out\n\n"],["paths=(APP,OBSERVER,GUARD,BASE,NAV)","paths=(APP,OBSERVER,GUARD,BASE,NAV,PACKAGE)"],["nav_transform(NAV.read_text(encoding=\"utf-8\")))","nav_transform(NAV.read_text(encoding=\"utf-8\")),\n              package_transform(PACKAGE.read_text(encoding=\"utf-8\")))"],["M110 scope required","M111 scope required"],["unrecognized M110 scope","unrecognized M111 scope"],["M110 exact M109 app with version-specific focus control","M111 M110 control plus measured safe insets"],["M110 disposable Debug activity probe installed","M111 disposable Debug activity probe installed"],["M110 scoped matrix not attested","M111 scoped safe inset experiment not attested"]]));
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib, os, json',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_safe_insets_m111 as m',
 'import guardiao_debug_root_view_matrix_m110 as p',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M111 four exact app changes preserve M110 root and use measured edges without warning suppression',()=>run([
 'source=m.APP.read_text(encoding="utf-8")',
 'control=p.app_transform(source)',
 'out=m.app_transform(source)',
 'assert len(m.INSET_PAIRS)==4',
 'restored=out',
 'for old,new in reversed(m.INSET_PAIRS):',
 ' assert restored.count(new)==1',
 ' restored=restored.replace(new,old)',
 'assert restored==control',
 'assert "SafeAreaView" not in out and "LogBox.ignore" not in out and "StatusBar.currentHeight" not in out',
 'assert out.count("<SafeAreaProvider initialMetrics={initialWindowMetrics} style={s.root}>")==1',
 'assert out.count("useSafeAreaInsets()")==1',
 'assert "paddingTop:insets.top,paddingBottom:insets.bottom,paddingLeft:insets.left,paddingRight:insets.right" in out',
 'assert "const bottomInset=insets.bottom;" in out',
 'for bad in ("",source+source,out):',
 ' try: m.app_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M111 adds exactly one pinned disposable native dependency',()=>run([
 'source=m.PACKAGE.read_text(encoding="utf-8")',
 'out=m.package_transform(source)',
 'assert out.replace(m.PACKAGE_NEW,m.PACKAGE_OLD)==source',
 'before=json.loads(source)',
 'after=json.loads(out)',
 'assert after["dependencies"].pop("react-native-safe-area-context")=="5.6.0"',
 'assert before==after',
 'for bad in ("",source+source,out):',
 ' try: m.package_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M111 retains M110 SDK and focus predicates and original guarded navigation',()=>run([
 'observer=m.OBSERVER.read_text(encoding="utf-8")',
 'assert m.APIS==p.APIS==("28","29","35")',
 'for api in m.APIS: assert m.matrix_observer(observer,api)==p.matrix_observer(observer,api)',
 'orig=m.NAV.read_text(encoding="utf-8")',
 'out=m.nav_transform(orig)',
 'ast.parse(out)',
 'assert out.replace(m.NEW,m.OLD)==orig',
 'assert out.replace("guardiao_debug_safe_insets_m111","guardiao_debug_root_view_matrix_m110")==p.nav_transform(orig)',
 'assert m.FIXTURE==p.FIXTURE and m.HOOK==p.HOOK',
 'assert m.subtree_transform is p.subtree_transform and m.xml_transform is p.xml_transform',
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
 'for api in ("28","29","36"):',
 ' os.environ["M93_EXPECTED_API"]=api',
 ' with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert len(calls)==1'
]));
test('M111 preserves M110 evidence and production gates',()=>{
 for(const x of ['M110','1,835/1,835','6/6 cycles','same PID','no PDF','API28','API29','API35','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
});
