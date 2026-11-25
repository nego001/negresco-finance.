#!/usr/bin/env python3
"""M110: exact M109 app across API28, API29, API35."""
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

APIS = ("28", "29", "35")
LAB_REF = "refs/heads/lab/p01-guardiao-debug-root-view-matrix-m110-v1"
NEW = OLD.replace('        raise RuntimeError', '        from guardiao_debug_root_view_matrix_m110 import report_after_block\n        report_after_block(nodes, pid)\n        raise RuntimeError')
ACT = Path("apps/mobile/android/app/src/main/java/com/negresco/finance/MainActivity.kt")
FIXTURE = Path("tooling/android/fixtures/GuardiaoNativeProbeM107.kt")
HELPER = ACT.with_name("GuardiaoNativeProbeM107.kt")
ANCHOR = "class MainActivity : ReactActivity() {"
HOOK = '''
  override fun dump(prefix: String, fd: java.io.FileDescriptor?, writer: java.io.PrintWriter, args: Array<out String>?) {
    super.dump(prefix, fd, writer, args)
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
    if not scope() or any(not p.is_file() or p.is_symlink() for p in (ACT,FIXTURE)) or HELPER.exists() or HELPER.is_symlink():
        raise RuntimeError("unexpected native probe scope")
    source=ACT.read_text(encoding="utf-8")
    helper=FIXTURE.read_text(encoding="utf-8")
    if not source.startswith("package com.negresco.finance") or not helper.startswith("package com.negresco.finance"):
        raise RuntimeError("unexpected package")
    out=activity_transform(source)
    ACT.write_text(out,encoding="utf-8")
    with HELPER.open("x",encoding="utf-8") as f:
        f.write(helper)
    if ACT.read_text(encoding="utf-8")!=out or HELPER.read_text(encoding="utf-8")!=helper:
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

ROOT_PAIRS = [["Easing, SafeAreaView, ScrollView","Easing, ScrollView"],["React.ElementRef<typeof SafeAreaView>|null","React.ElementRef<typeof View>|null"],["return <SafeAreaView ref={__DEV__?labWindowRoot:undefined}","return <View ref={__DEV__?labWindowRoot:undefined}"],["  </SafeAreaView>;\n}\nconst s=StyleSheet.create({","  </View>;\n}\nconst s=StyleSheet.create({"]]

def app_transform(source):
    control = m91_pure(source)
    if "LogBox.ignore" in control or control.count("SafeAreaView") != 4:
        raise RuntimeError("unexpected legacy root source")
    out = control
    for old,new in ROOT_PAIRS:
        if out.count(old) != 1:
            raise RuntimeError("root replacement anchor unconfirmed")
        out = out.replace(old,new)
    if "SafeAreaView" in out or "LogBox.ignore" in out:
        raise RuntimeError("unexpected warning suppression or remaining legacy root")
    restored = out
    for old,new in reversed(ROOT_PAIRS):
        if restored.count(new) != 1:
            raise RuntimeError("root replacement reverse anchor unconfirmed")
        restored = restored.replace(new,old)
    if restored != control:
        raise RuntimeError("nonisolated root replacement")
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
        raise RuntimeError("M110 scope required")
    paths=(APP,OBSERVER,GUARD,BASE,NAV)
    if any(not p.is_file() or p.is_symlink() for p in paths):
        raise RuntimeError("unexpected source path")
    contents=(app_transform(APP.read_text(encoding="utf-8")),
              matrix_observer(OBSERVER.read_text(encoding="utf-8"),os.environ.get("M93_EXPECTED_API")),
              subtree_transform(GUARD.read_text(encoding="utf-8")),
              xml_transform(BASE.read_text(encoding="utf-8")),
              nav_transform(NAV.read_text(encoding="utf-8")))
    for path,content in zip(paths,contents):
        path.write_text(content,encoding="utf-8")
        if path.read_text(encoding="utf-8")!=content:
            raise RuntimeError("temporary source not attested")

if __name__=="__main__":
    try:
        if not scope() or len(sys.argv)!=2 or sys.argv[1] not in ("apply","install"):
            raise RuntimeError("unrecognized M110 scope")
        if sys.argv[1]=="apply":
            apply()
            print("PASS (LAB): M110 exact M109 app with version-specific focus control",flush=True)
        else:
            install()
            print("PASS (LAB): M110 disposable Debug activity probe installed",flush=True)
    except Exception:
        print("BLOCK (LAB): M110 scoped matrix not attested",file=sys.stderr)
        raise SystemExit(1)
