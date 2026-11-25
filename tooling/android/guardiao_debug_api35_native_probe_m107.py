#!/usr/bin/env python3
"""M107: native Debug-only direct View census via existing post-block dump."""
from __future__ import annotations
import os
from pathlib import Path
import re
import sys
from guardiao_debug_api35_view_format_m106 import (
    APP, OBSERVER, GUARD, BASE, NAV, OLD, m91_pure, organized_transform,
    subtree_transform, xml_transform, private_sizes, ACTIVITY, LIMIT,
)

LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-native-probe-m107-v1"
NEW = OLD.replace('        raise RuntimeError', '        from guardiao_debug_api35_native_probe_m107 import report_after_block\n        report_after_block(nodes, pid)\n        raise RuntimeError')
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
            and os.environ.get("M93_EXPECTED_API")=="35")

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
        if not scope():
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

def apply():
    if not scope():
        raise RuntimeError("M107 scope required")
    paths=(APP,OBSERVER,GUARD,BASE,NAV)
    if any(not p.is_file() or p.is_symlink() for p in paths):
        raise RuntimeError("unexpected source path")
    contents=(m91_pure(APP.read_text(encoding="utf-8")),
              organized_transform(OBSERVER.read_text(encoding="utf-8"),"35"),
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
            raise RuntimeError("unrecognized M107 scope")
        if sys.argv[1]=="apply":
            apply()
            print("PASS (LAB): M107 exact M106 control plus native probe reader",flush=True)
        else:
            install()
            print("PASS (LAB): M107 disposable Debug activity probe installed",flush=True)
    except Exception:
        print("BLOCK (LAB): M107 scoped native probe not attested",file=sys.stderr)
        raise SystemExit(1)
