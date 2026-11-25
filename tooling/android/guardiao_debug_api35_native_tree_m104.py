#!/usr/bin/env python3
"""M104: one native view hierarchy read after existing pre-Pix BLOCK."""
from __future__ import annotations
import os
from pathlib import Path
import re
import sys
from guardiao_debug_api35_overlap_subtree_m103 import APP, OBSERVER, GUARD, BASE, m91_pure, organized_transform, subtree_transform, xml_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-native-tree-m104-v1"
NAV = Path("tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py")
OLD = "        PRE_PIX_DIAGNOSTIC = \"pre-pix-target-unconfirmed\"\n        raise RuntimeError(\"unsafe Pix candidate\")"
NEW = "        PRE_PIX_DIAGNOSTIC = \"pre-pix-target-unconfirmed\"\n        from guardiao_debug_api35_native_tree_m104 import report_after_block\n        report_after_block(nodes, pid)\n        raise RuntimeError(\"unsafe Pix candidate\")"
LIMIT = 2_000_000
ACTIVITY = re.compile(r"^\s*ACTIVITY com\.negresco\.finance/(?:\.MainActivity|com\.negresco\.finance\.MainActivity)(?:\s|$)")
VIEW = re.compile(r"(?P<class>[A-Za-z0-9_.$]+)\{[0-9a-fA-F]+ (?P<flags>[A-Z.]{9}) [A-Z.]{8} (?P<x1>-?[0-9]{1,6}),(?P<y1>-?[0-9]{1,6})-(?P<x2>-?[0-9]{1,6}),(?P<y2>-?[0-9]{1,6})(?: [^{}\r\n]*)?\}")
DECOR = re.compile(r"DecorView@[0-9a-fA-F]+\[MainActivity\]")

def nav_transform(source):
    if source.count(OLD) != 1 or NEW in source:
        raise RuntimeError("original pre-Pix rejection not attested")
    changed = source.replace(OLD, NEW)
    if changed.replace(NEW, OLD) != source:
        raise RuntimeError("nonisolated post-block diagnostic")
    return changed

def native_kind(klass):
    exact = {
        "com.facebook.react.views.view.ReactViewGroup": "react-viewgroup",
        "com.facebook.react.ReactRootView": "react-root",
        "com.facebook.react.runtime.ReactSurfaceView": "react-surface",
        "android.view.ViewGroup": "android-viewgroup",
        "android.widget.FrameLayout": "android-frame",
        "android.widget.LinearLayout": "android-linear",
        "android.view.View": "android-view",
    }
    if klass in exact:
        return exact[klass]
    if klass.startswith("com.facebook.react.devsupport."):
        return "react-devsupport"
    if klass.startswith("expo.modules."):
        return "expo-module"
    if klass.startswith("androidx."):
        return "androidx"
    return "other-class"

def parse_native(raw):
    """Parse one attested activity hierarchy, with no raw output or fallback."""
    if type(raw) is not str or not raw or len(raw) > LIMIT:
        return "response-unconfirmed", []
    lines = raw.splitlines()
    starts = [i for i,line in enumerate(lines) if ACTIVITY.match(line)]
    if len(starts) != 1:
        return "activity-unconfirmed", []
    start = starts[0]
    end = next((i for i in range(start+1,len(lines)) if lines[i].lstrip().startswith("ACTIVITY ")),len(lines))
    headers = [i for i in range(start+1,end) if lines[i].strip()=="View Hierarchy:"]
    if len(headers) != 1 or headers[0]+1>=end:
        return "hierarchy-unconfirmed", []
    hi = headers[0]
    indent = len(lines[hi])-len(lines[hi].lstrip())
    root = lines[hi+1]
    rootindent = len(root)-len(root.lstrip())
    if rootindent <= indent or not DECOR.fullmatch(root.strip()):
        return "decor-unconfirmed", []
    stack = [(rootindent,None)]
    views = []
    for line in lines[hi+2:end]:
        if not line.strip():
            break
        depth = len(line)-len(line.lstrip())
        if depth <= rootindent:
            break
        m = VIEW.fullmatch(line.strip())
        if not m or len(views)>=20000:
            return "view-format-unconfirmed", []
        while stack and stack[-1][0]>=depth:
            stack.pop()
        if not stack:
            return "view-format-unconfirmed", []
        x1,y1,x2,y2 = (int(m.group(k)) for k in ("x1","y1","x2","y2"))
        flags=m.group("flags")
        item=(native_kind(m.group("class")), (x2-x1,y2-y1), flags[0]=="V" and flags[2]=="E" and flags[6]=="C", stack[-1][1])
        stack.append((depth,len(views)))
        views.append(item)
    return ("parsed", views) if views else ("view-format-unconfirmed", [])

def classify_native(raw, size, parent_size):
    state, views = parse_native(raw)
    if state != "parsed":
        return state, "unconfirmed", "unconfirmed"
    hits=[v for v in views if v[2] and v[1]==size]
    if not hits:
        return "no-size-match", "unconfirmed", "unconfirmed"
    paired=[v for v in hits if v[3] is not None and views[v[3]][1]==parent_size]
    if len(paired)!=1:
        return ("ambiguous-pair" if len(paired)>1 else "no-parent-size-match"), "unconfirmed", "unconfirmed"
    item=paired[0]
    return "unique-size-pair-candidate",item[0],views[item[3]][0]

def private_sizes(nodes):
    import guardiao_api28_debug_nav_preview_guard as gate
    hits=[n for n in nodes if gate.observer.debug.safe_testid_matches(n,gate.TARGETS[1])]
    if len(hits)!=1 or hits[0].get("package")!=gate.PACKAGE:
        return None
    target=hits[0]
    rect=gate._rectangle(target.get("bounds"))
    if rect is None:
        return None
    cx,cy=(rect[0]+rect[2])//2,(rect[1]+rect[3])//2
    covers=[]
    for i,n in enumerate(nodes):
        if n is target or n.get("enabled")!="true" or n.get("clickable")!="true":
            continue
        r=gate._rectangle(n.get("bounds"))
        if r is None:
            return None
        if r[0]<=cx<=r[2] and r[1]<=cy<=r[3]:
            covers.append((i,n,r))
    if len(covers)!=1:
        return None
    i,n,r=covers[0]
    if (n.get("package")!=gate.PACKAGE or n.get("class")!="android.view.ViewGroup"
        or n.get("resource-id")!="" or gate._m100_relation(nodes,target,n)!="separate-branch"
        or gate._m102_identity(n)!="unknown" or gate._m102_scroll_ancestry(nodes,n)!="no-scroll-ancestor"):
        return None
    if r==rect or (r[0]<=rect[0] and r[1]<=rect[1] and r[2]>=rect[2] and r[3]>=rect[3]) or (rect[0]<=r[0] and rect[1]<=r[1] and rect[2]>=r[2] and rect[3]>=r[3]):
        return None
    chain=gate._m103_chain(nodes,i)
    if chain is None or len(chain)<2:
        return None
    parent=nodes[chain[1]]
    if parent.get("package")!=gate.PACKAGE:
        return None
    pr=gate._rectangle(parent.get("bounds"))
    if pr is None:
        return None
    dims=(r[2]-r[0],r[3]-r[1]),(pr[2]-pr[0],pr[3]-pr[1])
    return dims if all(0<v<=100000 for pair in dims for v in pair) else None

def report_after_block(nodes,pid):
    """Never authorize a touch, never retry; one read only after attested block."""
    import guardiao_api28_debug_external_a11y_readonly_lab as observer
    try:
        if (os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_REF")!=LAB_REF
            or os.environ.get("M93_EXPECTED_API")!="35"):
            print("ENV (LAB): m104-native=scope-unconfirmed",flush=True)
            return
        sizes=private_sizes(nodes)
        if sizes is None:
            print("ENV (LAB): m104-native=snapshot-unconfirmed",flush=True)
            return
        if observer.debug_pid()!=pid or not observer.debug_focus():
            print("ENV (LAB): m104-native=process-unconfirmed",flush=True)
            return
        raw=observer.BASE.adb("shell","dumpsys","activity","top",timeout=22)
        if observer.debug_pid()!=pid or not observer.debug_focus():
            print("ENV (LAB): m104-native=process-unconfirmed",flush=True)
            return
        state,kind,parent=classify_native(raw,*sizes)
        print("ENV (LAB): m104-native="+state,flush=True)
        print("ENV (LAB): m104-native-kind="+kind,flush=True)
        print("ENV (LAB): m104-native-parent="+parent,flush=True)
    except Exception:
        print("ENV (LAB): m104-native=read-unconfirmed",flush=True)

def apply(api):
    if api!="35":
        raise RuntimeError("M104 exact API35 required")
    paths=(APP,OBSERVER,GUARD,BASE,NAV)
    if any(not p.is_file() or p.is_symlink() for p in paths):
        raise RuntimeError("unexpected source path")
    contents=(m91_pure(APP.read_text(encoding="utf-8")),
              organized_transform(OBSERVER.read_text(encoding="utf-8"),api),
              subtree_transform(GUARD.read_text(encoding="utf-8")),
              xml_transform(BASE.read_text(encoding="utf-8")),
              nav_transform(NAV.read_text(encoding="utf-8")))
    for path,content in zip(paths,contents):
        path.write_text(content,encoding="utf-8")
        if path.read_text(encoding="utf-8")!=content:
            raise RuntimeError("temporary source not attested")

if __name__=="__main__":
    try:
        if (sys.argv!=[sys.argv[0],"apply"] or os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_REF")!=LAB_REF):
            raise RuntimeError("unrecognized M104 branch")
        apply(os.environ.get("M93_EXPECTED_API"))
        print("PASS (LAB): M104 exact M103 control plus blocked native tree diagnostic",flush=True)
    except Exception:
        print("BLOCK (LAB): M104 scoped native tree diagnostic not attested",file=sys.stderr)
        raise SystemExit(1)
