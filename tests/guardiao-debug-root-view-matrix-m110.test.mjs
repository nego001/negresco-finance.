import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
import {originalManifest} from './helpers/guardiao_dependency_state_m143.mjs';
historicalAppPath();
originalManifest();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-root-view-m109.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-root-view-matrix-m110.yml','utf8');
const oldScript=readFileSync('tooling/android/guardiao_debug_api35_root_view_m109.py','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_root_view_matrix_m110.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_ROOT_VIEW_MATRIX_M110.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M110 exact M109 workflow and script except matrix and scoped observer selection',()=>{
 assert.equal(current,apply(old,[["Guardiao Debug API35 root view M109","Guardiao Debug root view matrix M110"],["lab/p01-guardiao-debug-api35-root-view-m109-v1","lab/p01-guardiao-debug-root-view-matrix-m110-v1"],["guardiao-debug-api35-root-view-m109-","guardiao-debug-root-view-matrix-m110-"],["M109 API ${{ matrix.api }} - root view","M110 API ${{ matrix.api }} - root view matrix"],["api: [35]","api: [28, 29, 35]"],["Apply exact M107 control plus Android root View replacement","Apply exact M109 app with version-specific focus control"],["guardiao_debug_api35_root_view_m109.py apply","guardiao_debug_root_view_matrix_m110.py apply"],["guardiao_debug_api35_root_view_m109.py install","guardiao_debug_root_view_matrix_m110.py install"]]));
 assert.equal(patch,apply(oldScript,[["M109: replace legacy Android root with View, no warning filter.","M110: exact M109 app across API28, API29, API35."],["lab/p01-guardiao-debug-api35-root-view-m109-v1","lab/p01-guardiao-debug-root-view-matrix-m110-v1"],["from guardiao_debug_api35_root_view_m109 import report_after_block","from guardiao_debug_root_view_matrix_m110 import report_after_block"],["LAB_REF =","from guardiao_debug_compat_display_focus_m96 import display_transform\nfrom guardiao_debug_zindex_one_compat_m93 import OLD as SDK28_GUARD\n\nAPIS = (\"28\", \"29\", \"35\")\nLAB_REF ="],["and os.environ.get(\"M93_EXPECTED_API\")==\"35\")","and os.environ.get(\"M93_EXPECTED_API\") in APIS)"],["        if not scope():\n            print(\"ENV (LAB): m107-native=scope-unconfirmed\",flush=True)","        if not scope() or os.environ.get(\"M93_EXPECTED_API\")!=\"35\":\n            print(\"ENV (LAB): m107-native=scope-unconfirmed\",flush=True)"],["def apply():","def matrix_observer(source, api):\n    if type(api) is not str or api not in APIS:\n        raise RuntimeError(\"M110 exact matrix SDK required\")\n    if api == \"28\":\n        if source.count(SDK28_GUARD) != 1:\n            raise RuntimeError(\"original API28 guard not uniquely attested\")\n        return source\n    if api == \"29\":\n        return display_transform(source, api)\n    return organized_transform(source, api)\n\ndef apply():"],["organized_transform(OBSERVER.read_text(encoding=\"utf-8\"),\"35\")","matrix_observer(OBSERVER.read_text(encoding=\"utf-8\"),os.environ.get(\"M93_EXPECTED_API\"))"],["M109 scope required","M110 scope required"],["unrecognized M109 scope","unrecognized M110 scope"],["M109 exact M107 control plus Android root View replacement","M110 exact M109 app with version-specific focus control"],["M109 disposable Debug activity probe installed","M110 disposable Debug activity probe installed"],["M109 scoped root replacement not attested","M110 scoped matrix not attested"]]));
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_root_view_matrix_m110 as m',
 'import guardiao_debug_api35_root_view_m109 as p',
 'import guardiao_debug_compat_display_focus_m96 as d',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M110 exact M109 app and existing API-specific focus and SDK predicates',()=>run([
 'source=__import__("pathlib").Path("tooling/android/fixtures/m139-historical-baseline/App.tsx").read_text(encoding="utf-8")',
 'observer=m.OBSERVER.read_text(encoding="utf-8")',
 'assert m.APIS==("28","29","35")',
 'assert m.app_transform(source)==p.app_transform(source)',
 'assert m.matrix_observer(observer,"28")==observer',
 'assert m.matrix_observer(observer,"29")==d.display_transform(observer,"29")',
 'assert m.matrix_observer(observer,"35")==p.organized_transform(observer,"35")',
 'for api in m.APIS: ast.parse(m.matrix_observer(observer,api))',
 'for bad in (None,28,"30","36"):',
 ' try: m.matrix_observer(observer,bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass',
 'try: m.matrix_observer("","28"); raise AssertionError("must reject")',
 'except RuntimeError: pass'
]));
test('M110 exact guard and API35-only post-block native read',()=>run([
 'orig=m.NAV.read_text(encoding="utf-8")',
 'out=m.nav_transform(orig)',
 'assert out.replace(m.NEW,m.OLD)==orig',
 'assert out.replace("guardiao_debug_root_view_matrix_m110","guardiao_debug_api35_root_view_m109")==p.nav_transform(orig)',
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
 'assert len(calls)==1',
 'os.environ.update(GITHUB_REF=p.LAB_REF,M93_EXPECTED_API="35")',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert len(calls)==1'
]));
test('M110 preserves M109 evidence and production gates',()=>{
 for(const x of ['M109','1,831/1,831','two guarded Home-Pix-Home Debug preview cycles','same PID','no PDF','API28','API29','API35','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
});
