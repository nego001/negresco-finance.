#!/usr/bin/env python3
"""M112: final native safe-edge proof over exact M111 control."""
from __future__ import annotations
import os
from pathlib import Path
import re
import sys
from guardiao_debug_api35_view_format_m106 import (
    APP, OBSERVER, GUARD, BASE, NAV, OLD, m91_pure, organized_transform,
    subtree_transform, xml_transform, private_sizes, ACTIVITY, LIMIT,
)

from guardiao_debug_compat_display_focus_m96 import display_transform
from guardiao_debug_zindex_one_compat_m93 import OLD as SDK28_GUARD

from guardiao_debug_root_view_matrix_m110 import app_transform as m110_app_transform

APIS = ("28", "29", "35")
LAB_REF = "refs/heads/lab/p01-guardiao-debug-nav-modes-m113-v1"
NEW = OLD.replace('        raise RuntimeError', '        from guardiao_debug_nav_modes_m113 import report_after_block\n        report_after_block(nodes, pid)\n        raise RuntimeError')
ACT = Path("apps/mobile/android/app/src/main/java/com/negresco/finance/MainActivity.kt")
FIXTURE = Path("tooling/android/fixtures/GuardiaoNativeProbeM107.kt")
HELPER = ACT.with_name("GuardiaoNativeProbeM107.kt")
ANCHOR = "class MainActivity : ReactActivity() {"
HOOK = '''
  override fun dump(prefix: String, fd: java.io.FileDescriptor?, writer: java.io.PrintWriter, args: Array<out String>?) {
    super.dump(prefix, fd, writer, args)
    if (BuildConfig.DEBUG && android.os.Build.VERSION.SDK_INT in setOf(28, 29, 35)) {
      GuardiaoSafeEdgeProofM112.dump(this, prefix, writer)
    }
    if (BuildConfig.DEBUG && android.os.Build.VERSION.SDK_INT == 35) {
      GuardiaoNativeProbeM107.dump(this, prefix, writer)
    }
  }
'''
MARKER = "NEGRESCO_LAB_M107_NATIVE "
STATES = frozenset(("scope-unconfirmed","root-unconfirmed","limit-unconfirmed","anchors-unconfirmed",
                    "subtree-unconfirmed","target-unconfirmed","no-native-candidate","multiple-native-candidates",
                    "parent-unconfirmed","geometry-unconfirmed","probe-unconfirmed"))
KINDS = frozenset(("react-viewgroup","react-root","react-surface","android-frame","android-linear",
                   "android-viewgroup","android-view","react-devsupport","expo-module","androidx","other-class"))

STAGING = Path("tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py")
EDGE_FIXTURE = Path("tooling/android/fixtures/GuardiaoSafeEdgeProofM112.kt")
EDGE_HELPER = ACT.with_name("GuardiaoSafeEdgeProofM112.kt")
EDGE_MARKER = "NEGRESCO_LAB_M112_SAFE_EDGES "
EDGE_STATES = frozenset(("inside-safe-edges","scope-unconfirmed","decor-unconfirmed",
                        "safe-rectangle-unconfirmed","view-limit-unconfirmed","home-unconfirmed",
                        "anchors-unconfirmed","anchor-frame-unconfirmed","outside-safe-edges",
                        "vertical-order-unconfirmed","tab-overlap-unconfirmed","proof-unconfirmed"))
RUNNER_OLD = "    print(\"PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID\","
RUNNER_NEW = "    from guardiao_debug_nav_modes_m113 import attest_final_edges\n    attest_final_edges(baseline_pid)\n    print(\"PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID\","

def runner_transform(source):
    if source.count(RUNNER_OLD)!=1 or RUNNER_NEW in source:
        raise RuntimeError("unexpected final cycle proof anchor")
    out=source.replace(RUNNER_OLD,RUNNER_NEW)
    if out.replace(RUNNER_NEW,RUNNER_OLD)!=source:
        raise RuntimeError("nonisolated final proof")
    return out

def classify_edges(raw):
    if type(raw) is not str or not raw or len(raw)>LIMIT:
        return "response-unconfirmed"
    lines=raw.splitlines()
    starts=[i for i,line in enumerate(lines) if ACTIVITY.match(line)]
    if len(starts)!=1:
        return "activity-unconfirmed"
    start=starts[0]
    end=next((i for i in range(start+1,len(lines)) if lines[i].lstrip().startswith("ACTIVITY ")),len(lines))
    markers=[line.strip()[len(EDGE_MARKER):] for line in lines[start+1:end] if line.strip().startswith(EDGE_MARKER)]
    if len(markers)!=1 or markers[0] not in EDGE_STATES:
        return "marker-unconfirmed"
    return markers[0]

def attest_final_edges(pid):
    import guardiao_api28_debug_external_a11y_readonly_lab as observer
    state="scope-unconfirmed"
    if scope():
        try:
            if observer.debug_pid()!=pid or not observer.debug_focus():
                state="process-unconfirmed"
            else:
                raw=observer.BASE.adb("shell","dumpsys","activity","top",timeout=22)
                if observer.debug_pid()!=pid or not observer.debug_focus():
                    state="process-unconfirmed"
                else:
                    state=classify_edges(raw)
        except Exception:
            state="read-unconfirmed"
    print("ENV (LAB): m112-safe-edges="+state,flush=True)
    if state!="inside-safe-edges":
        raise RuntimeError("final safe edges not attested")
    print("PASS (LAB): final Home header and three tabs inside native safe edges",flush=True)

def scope():
    return (os.environ.get("GITHUB_ACTIONS")=="true" and os.environ.get("GITHUB_REF")==LAB_REF
            and os.environ.get("M93_EXPECTED_API") in APIS)

def nav_transform(source):
    if source.count(OLD)!=1 or NEW in source:
        raise RuntimeError("original rejection not attested")
    out=source.replace(OLD,NEW)
    if out.replace(NEW,OLD)!=source:
        raise RuntimeError("nonisolated navigation hook")
    return out

def activity_transform(source):
    if source.count(ANCHOR)!=1 or HOOK in source or re.search(r"\bfun\s+dump\s*\(",source):
        raise RuntimeError("unexpected generated MainActivity")
    out=source.replace(ANCHOR,ANCHOR+"\n"+HOOK)
    if out.replace(ANCHOR+"\n"+HOOK,ANCHOR)!=source:
        raise RuntimeError("nonisolated activity hook")
    return out

def install():
    if not scope() or any(not p.is_file() or p.is_symlink() for p in (ACT,FIXTURE,EDGE_FIXTURE)) or HELPER.exists() or HELPER.is_symlink() or EDGE_HELPER.exists() or EDGE_HELPER.is_symlink():
        raise RuntimeError("unexpected native probe scope")
    source=ACT.read_text(encoding="utf-8")
    helper=FIXTURE.read_text(encoding="utf-8")
    edge=EDGE_FIXTURE.read_text(encoding="utf-8")
    if not source.startswith("package com.negresco.finance") or not helper.startswith("package com.negresco.finance") or not edge.startswith("package com.negresco.finance"):
        raise RuntimeError("unexpected package")
    out=activity_transform(source)
    ACT.write_text(out,encoding="utf-8")
    with HELPER.open("x",encoding="utf-8") as f:
        f.write(helper)
    with EDGE_HELPER.open("x",encoding="utf-8") as f:
        f.write(edge)
    if ACT.read_text(encoding="utf-8")!=out or HELPER.read_text(encoding="utf-8")!=helper or EDGE_HELPER.read_text(encoding="utf-8")!=edge:
        raise RuntimeError("native probe install unconfirmed")

def classify_probe(raw,sizes):
    if type(raw) is not str or not raw or len(raw)>LIMIT:
        return "response-unconfirmed","unconfirmed","unconfirmed"
    lines=raw.splitlines()
    starts=[i for i,line in enumerate(lines) if ACTIVITY.match(line)]
    if len(starts)!=1:
        return "activity-unconfirmed","unconfirmed","unconfirmed"
    start=starts[0]
    end=next((i for i in range(start+1,len(lines)) if lines[i].lstrip().startswith("ACTIVITY ")),len(lines))
    markers=[line.strip()[len(MARKER):] for line in lines[start+1:end] if line.strip().startswith(MARKER)]
    if len(markers)!=1:
        return "marker-unconfirmed","unconfirmed","unconfirmed"
    parts=markers[0].split(" ")
    if len(parts)==1 and parts[0] in STATES:
        return parts[0],"unconfirmed","unconfirmed"
    if (len(parts)!=7 or parts[0]!="unique-native-candidate" or any(k not in KINDS for k in parts[1:3])
        or any(re.fullmatch(r"[1-9][0-9]{0,5}",s) is None for s in parts[3:])):
        return "marker-unconfirmed","unconfirmed","unconfirmed"
    dims=tuple(map(int,parts[3:]))
    if dims!=sizes[0]+sizes[1]:
        return "geometry-mismatch","unconfirmed","unconfirmed"
    return "unique-geometry-pair-candidate",parts[1],parts[2]

def report_after_block(nodes,pid):
    import guardiao_api28_debug_external_a11y_readonly_lab as observer
    try:
        if not scope() or os.environ.get("M93_EXPECTED_API")!="35":
            print("ENV (LAB): m107-native=scope-unconfirmed",flush=True)
            return
        sizes=private_sizes(nodes)
        if sizes is None:
            print("ENV (LAB): m107-native=snapshot-unconfirmed",flush=True)
            return
        if observer.debug_pid()!=pid or not observer.debug_focus():
            print("ENV (LAB): m107-native=process-unconfirmed",flush=True)
            return
        raw=observer.BASE.adb("shell","dumpsys","activity","top",timeout=22)
        if observer.debug_pid()!=pid or not observer.debug_focus():
            print("ENV (LAB): m107-native=process-unconfirmed",flush=True)
            return
        state,kind,parent=classify_probe(raw,sizes)
        print("ENV (LAB): m107-native="+state,flush=True)
        print("ENV (LAB): m107-native-kind="+kind,flush=True)
        print("ENV (LAB): m107-native-parent="+parent,flush=True)
    except Exception:
        print("ENV (LAB): m107-native=read-unconfirmed",flush=True)

PACKAGE = Path("apps/mobile/package.json")
PACKAGE_OLD = "    \"react-native\": \"0.81.4\","
PACKAGE_NEW = "    \"react-native\": \"0.81.4\",\n    \"react-native-safe-area-context\": \"5.6.0\","
INSET_PAIRS = [["type Page = 'Início' | 'Pix'","import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';\n\ntype Page = 'Início' | 'Pix'"],["export default function App() {\n  const [page,setPage]","export default function App() {\n  return <SafeAreaProvider initialMetrics={initialWindowMetrics} style={s.root}><AppContent/></SafeAreaProvider>;\n}\nfunction AppContent() {\n  const insets=useSafeAreaInsets();\n  const [page,setPage]"],["{paddingTop:Platform.OS==='android'?(StatusBar.currentHeight??24):0},Platform.OS==='android'&&{paddingBottom:(StatusBar.currentHeight??24)}","{paddingTop:insets.top,paddingBottom:insets.bottom,paddingLeft:insets.left,paddingRight:insets.right}"],["const statusInset=StatusBar.currentHeight??0;\n        edge=Number.isFinite(statusInset)&&statusInset>=0\n          ?overflow<=statusInset+8","const bottomInset=insets.bottom;\n        edge=Number.isFinite(bottomInset)&&bottomInset>=0\n          ?overflow<=bottomInset+8"]]

def package_transform(source):
    if source.count(PACKAGE_OLD)!=1 or "react-native-safe-area-context" in source:
        raise RuntimeError("unexpected package dependency")
    out=source.replace(PACKAGE_OLD,PACKAGE_NEW)
    if out.count(PACKAGE_NEW)!=1 or out.replace(PACKAGE_NEW,PACKAGE_OLD)!=source:
        raise RuntimeError("nonisolated dependency")
    return out

def app_transform(source):
    control=m110_app_transform(source)
    if "react-native-safe-area-context" in control or "LogBox.ignore" in control:
        raise RuntimeError("unexpected safe area control")
    out=control
    for old,new in INSET_PAIRS:
        if out.count(old)!=1:
            raise RuntimeError("inset anchor unconfirmed")
        out=out.replace(old,new)
    restored=out
    for old,new in reversed(INSET_PAIRS):
        if restored.count(new)!=1:
            raise RuntimeError("reverse inset anchor unconfirmed")
        restored=restored.replace(new,old)
    if restored!=control or "StatusBar.currentHeight" in out:
        raise RuntimeError("nonisolated inset change")
    return out

def matrix_observer(source, api):
    if type(api) is not str or api not in APIS:
        raise RuntimeError("M110 exact matrix SDK required")
    if api == "28":
        if source.count(SDK28_GUARD) != 1:
            raise RuntimeError("original API28 guard not uniquely attested")
        return source
    if api == "29":
        return display_transform(source, api)
    return organized_transform(source, api)

def apply():
    if not scope():
        raise RuntimeError("M112 scope required")
    paths=(APP,OBSERVER,GUARD,BASE,NAV,PACKAGE,STAGING)
    if any(not p.is_file() or p.is_symlink() for p in paths):
        raise RuntimeError("unexpected source path")
    contents=(app_transform(APP.read_text(encoding="utf-8")),
              matrix_observer(OBSERVER.read_text(encoding="utf-8"),os.environ.get("M93_EXPECTED_API")),
              subtree_transform(GUARD.read_text(encoding="utf-8")),
              xml_transform(BASE.read_text(encoding="utf-8")),
              nav_transform(NAV.read_text(encoding="utf-8")),
              package_transform(PACKAGE.read_text(encoding="utf-8")),
              runner_transform(STAGING.read_text(encoding="utf-8")))
    for path,content in zip(paths,contents):
        path.write_text(content,encoding="utf-8")
        if path.read_text(encoding="utf-8")!=content:
            raise RuntimeError("temporary source not attested")

if __name__=="__main__":
    try:
        if not scope() or len(sys.argv)!=2 or sys.argv[1] not in ("apply","install"):
            raise RuntimeError("unrecognized M112 scope")
        if sys.argv[1]=="apply":
            apply()
            print("PASS (LAB): M112 exact M111 control plus final safe-edge evidence",flush=True)
        else:
            install()
            print("PASS (LAB): M112 disposable Debug activity probes installed",flush=True)
    except Exception:
        print("BLOCK (LAB): M112 scoped safe-edge proof not attested",file=sys.stderr)
        raise SystemExit(1)
