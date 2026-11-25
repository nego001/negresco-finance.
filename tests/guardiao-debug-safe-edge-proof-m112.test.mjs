import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-safe-insets-m111.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-safe-edge-proof-m112.yml','utf8');
const oldScript=readFileSync('tooling/android/guardiao_debug_safe_insets_m111.py','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_safe_edge_proof_m112.py','utf8');
const kt=readFileSync('tooling/android/fixtures/GuardiaoSafeEdgeProofM112.kt','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_SAFE_EDGE_PROOF_M112.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M112 exact M111 workflow and bounded native proof delta',()=>{
 assert.equal(current,apply(old,[["Guardiao Debug safe insets M111","Guardiao Debug safe edge proof M112"],["lab/p01-guardiao-debug-safe-insets-m111-v1","lab/p01-guardiao-debug-safe-edge-proof-m112-v1"],["guardiao-debug-safe-insets-m111-","guardiao-debug-safe-edge-proof-m112-"],["M111 API ${{ matrix.api }} - safe insets","M112 API ${{ matrix.api }} - safe edge proof"],["Apply M110 control plus measured safe insets","Apply exact M111 control plus final safe-edge evidence"],["guardiao_debug_safe_insets_m111.py apply","guardiao_debug_safe_edge_proof_m112.py apply"],["guardiao_debug_safe_insets_m111.py install","guardiao_debug_safe_edge_proof_m112.py install"]]));
 assert.equal(patch,apply(oldScript,[["M111: measured safe insets over exact M110 Android Debug control.","M112: final native safe-edge proof over exact M111 control."],["lab/p01-guardiao-debug-safe-insets-m111-v1","lab/p01-guardiao-debug-safe-edge-proof-m112-v1"],["from guardiao_debug_safe_insets_m111 import report_after_block","from guardiao_debug_safe_edge_proof_m112 import report_after_block"],["    super.dump(prefix, fd, writer, args)\n","    super.dump(prefix, fd, writer, args)\n    if (BuildConfig.DEBUG && android.os.Build.VERSION.SDK_INT in setOf(28, 29, 35)) {\n      GuardiaoSafeEdgeProofM112.dump(this, prefix, writer)\n    }\n"],["def scope():","STAGING = Path(\"tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py\")\nEDGE_FIXTURE = Path(\"tooling/android/fixtures/GuardiaoSafeEdgeProofM112.kt\")\nEDGE_HELPER = ACT.with_name(\"GuardiaoSafeEdgeProofM112.kt\")\nEDGE_MARKER = \"NEGRESCO_LAB_M112_SAFE_EDGES \"\nEDGE_STATES = frozenset((\"inside-safe-edges\",\"scope-unconfirmed\",\"decor-unconfirmed\",\n                        \"safe-rectangle-unconfirmed\",\"view-limit-unconfirmed\",\"home-unconfirmed\",\n                        \"anchors-unconfirmed\",\"anchor-frame-unconfirmed\",\"outside-safe-edges\",\n                        \"vertical-order-unconfirmed\",\"tab-overlap-unconfirmed\",\"proof-unconfirmed\"))\nRUNNER_OLD = \"    print(\\\"PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID\\\",\"\nRUNNER_NEW = \"    from guardiao_debug_safe_edge_proof_m112 import attest_final_edges\\n    attest_final_edges(baseline_pid)\\n    print(\\\"PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID\\\",\"\n\ndef runner_transform(source):\n    if source.count(RUNNER_OLD)!=1 or RUNNER_NEW in source:\n        raise RuntimeError(\"unexpected final cycle proof anchor\")\n    out=source.replace(RUNNER_OLD,RUNNER_NEW)\n    if out.replace(RUNNER_NEW,RUNNER_OLD)!=source:\n        raise RuntimeError(\"nonisolated final proof\")\n    return out\n\ndef classify_edges(raw):\n    if type(raw) is not str or not raw or len(raw)>LIMIT:\n        return \"response-unconfirmed\"\n    lines=raw.splitlines()\n    starts=[i for i,line in enumerate(lines) if ACTIVITY.match(line)]\n    if len(starts)!=1:\n        return \"activity-unconfirmed\"\n    start=starts[0]\n    end=next((i for i in range(start+1,len(lines)) if lines[i].lstrip().startswith(\"ACTIVITY \")),len(lines))\n    markers=[line.strip()[len(EDGE_MARKER):] for line in lines[start+1:end] if line.strip().startswith(EDGE_MARKER)]\n    if len(markers)!=1 or markers[0] not in EDGE_STATES:\n        return \"marker-unconfirmed\"\n    return markers[0]\n\ndef attest_final_edges(pid):\n    import guardiao_api28_debug_external_a11y_readonly_lab as observer\n    state=\"scope-unconfirmed\"\n    if scope():\n        try:\n            if observer.debug_pid()!=pid or not observer.debug_focus():\n                state=\"process-unconfirmed\"\n            else:\n                raw=observer.BASE.adb(\"shell\",\"dumpsys\",\"activity\",\"top\",timeout=22)\n                if observer.debug_pid()!=pid or not observer.debug_focus():\n                    state=\"process-unconfirmed\"\n                else:\n                    state=classify_edges(raw)\n        except Exception:\n            state=\"read-unconfirmed\"\n    print(\"ENV (LAB): m112-safe-edges=\"+state,flush=True)\n    if state!=\"inside-safe-edges\":\n        raise RuntimeError(\"final safe edges not attested\")\n    print(\"PASS (LAB): final Home header and three tabs inside native safe edges\",flush=True)\n\ndef scope():"],["(ACT,FIXTURE)) or HELPER.exists() or HELPER.is_symlink():","(ACT,FIXTURE,EDGE_FIXTURE)) or HELPER.exists() or HELPER.is_symlink() or EDGE_HELPER.exists() or EDGE_HELPER.is_symlink():"],["    helper=FIXTURE.read_text(encoding=\"utf-8\")","    helper=FIXTURE.read_text(encoding=\"utf-8\")\n    edge=EDGE_FIXTURE.read_text(encoding=\"utf-8\")"],["or not helper.startswith(\"package com.negresco.finance\"):","or not helper.startswith(\"package com.negresco.finance\") or not edge.startswith(\"package com.negresco.finance\"):"],["    if ACT.read_text(encoding=\"utf-8\")!=out or HELPER.read_text(encoding=\"utf-8\")!=helper:","    with EDGE_HELPER.open(\"x\",encoding=\"utf-8\") as f:\n        f.write(edge)\n    if ACT.read_text(encoding=\"utf-8\")!=out or HELPER.read_text(encoding=\"utf-8\")!=helper or EDGE_HELPER.read_text(encoding=\"utf-8\")!=edge:"],["paths=(APP,OBSERVER,GUARD,BASE,NAV,PACKAGE)","paths=(APP,OBSERVER,GUARD,BASE,NAV,PACKAGE,STAGING)"],["package_transform(PACKAGE.read_text(encoding=\"utf-8\")))","package_transform(PACKAGE.read_text(encoding=\"utf-8\")),\n              runner_transform(STAGING.read_text(encoding=\"utf-8\")))"],["M111 scope required","M112 scope required"],["unrecognized M111 scope","unrecognized M112 scope"],["M111 M110 control plus measured safe insets","M112 exact M111 control plus final safe-edge evidence"],["M111 disposable Debug activity probe installed","M112 disposable Debug activity probes installed"],["M111 scoped safe inset experiment not attested","M112 scoped safe-edge proof not attested"]]));
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_safe_edge_proof_m112 as m',
 'import guardiao_debug_safe_insets_m111 as p',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M112 exact M111 app and guard, reversible final proof only after both cycles',()=>run([
 'assert m.app_transform(m.APP.read_text(encoding="utf-8"))==p.app_transform(p.APP.read_text(encoding="utf-8"))',
 'assert m.package_transform(m.PACKAGE.read_text(encoding="utf-8"))==p.package_transform(p.PACKAGE.read_text(encoding="utf-8"))',
 'source=m.OBSERVER.read_text(encoding="utf-8")',
 'for api in m.APIS: assert m.matrix_observer(source,api)==p.matrix_observer(source,api)',
 'assert m.subtree_transform is p.subtree_transform and m.xml_transform is p.xml_transform',
 'orig=m.NAV.read_text(encoding="utf-8")',
 'assert m.nav_transform(orig).replace("guardiao_debug_safe_edge_proof_m112","guardiao_debug_safe_insets_m111")==p.nav_transform(orig)',
 'source=m.STAGING.read_text(encoding="utf-8")',
 'out=m.runner_transform(source)',
 'ast.parse(out)',
 'assert out.replace(m.RUNNER_NEW,m.RUNNER_OLD)==source',
 'assert out.index("if LAST_COMPLETE")<out.index("attest_final_edges(baseline_pid)")<out.index(m.RUNNER_OLD)',
 'for bad in ("",source+source,out):',
 ' try: m.runner_transform(bad); raise AssertionError("must reject")',
 ' except RuntimeError: pass'
]));
test('M112 native proof uses actual window insets and fixed categories only',()=>{
 for(const x of ['BuildConfig.DEBUG','setOf(28, 29, 35)','hasWindowFocus()','Looper.myLooper()','rootWindowInsets','isConsumed','WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()','systemWindowInsetBottom','safeInsetBottom','getLocationOnScreen','getGlobalVisibleRect','safe.contains(it)','Rect.intersects','edges.all { it == 0 }','matches.any { it.size != 1 }','writer.println(prefix + "NEGRESCO_LAB_M112_SAFE_EDGES " + result)']) assert.ok(kt.includes(x),x);
 for(const x of ['dispatchTouchEvent','performClick','Log.','contentDescription','getText(','SharedPreferences']) assert.ok(!kt.includes(x),x);
});
test('M112 only one categorical marker inside one app activity accepted',()=>run([
 'a="ACTIVITY com.negresco.finance/.MainActivity abc pid=123\\n"',
 'line="  NEGRESCO_LAB_M112_SAFE_EDGES inside-safe-edges"',
 'assert m.classify_edges(a+line)=="inside-safe-edges"',
 'assert m.classify_edges(a+line+"\\n"+line)=="marker-unconfirmed"',
 'assert m.classify_edges(a+"ACTIVITY com.other/.MainActivity x\\n"+line)=="marker-unconfirmed"',
 'assert m.classify_edges(a+line.replace("inside-safe-edges","outside-safe-edges"))=="outside-safe-edges"',
 'assert m.classify_edges(a+line+" 123")=="marker-unconfirmed"',
 'assert m.classify_edges(line)=="activity-unconfirmed"'
]));
test('M112 final proof single read and fail closed before or after changed PID',()=>run([
 'import guardiao_api28_debug_external_a11y_readonly_lab as observer',
 'calls=[]',
 'raw="ACTIVITY com.negresco.finance/.MainActivity abc pid=123\\n  NEGRESCO_LAB_M112_SAFE_EDGES inside-safe-edges"',
 'observer.debug_pid=lambda:"123"',
 'observer.debug_focus=lambda:True',
 'observer.BASE.adb=lambda *args,**kwargs: calls.append((args,kwargs)) or raw',
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF=m.LAB_REF,M93_EXPECTED_API="35")',
 'stream=io.StringIO()',
 'with contextlib.redirect_stdout(stream): m.attest_final_edges("123")',
 'assert calls==[(("shell","dumpsys","activity","top"),{"timeout":22})]',
 'assert "m112-safe-edges=inside-safe-edges" in stream.getvalue()',
 'def reject():',
 ' with contextlib.redirect_stdout(stream):',
 '  try: m.attest_final_edges("123"); raise AssertionError("must reject")',
 '  except RuntimeError: pass',
 'os.environ["M93_EXPECTED_API"]="36"',
 'reject()',
 'assert len(calls)==1',
 'os.environ["M93_EXPECTED_API"]="28"',
 'observer.debug_pid=lambda:"changed"',
 'reject()',
 'assert len(calls)==1',
 'ids=iter(["123","changed"])',
 'observer.debug_pid=lambda:next(ids)',
 'reject()',
 'assert len(calls)==2',
 'observer.debug_pid=lambda:"123"',
 'raw=raw.replace("inside-safe-edges","outside-safe-edges")',
 'reject()',
 'assert len(calls)==3'
]));
test('M112 preserves M111 evidence and production gates',()=>{
 for(const x of ["M111","1,840/1,840","6/6 cycles","same PID","no PDF","API28","API29","API35","#120","#126","Draft","approvedForProduction=false","stableReleaseAllowed=false","29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"]) assert.ok(doc.includes(x),x);
});
