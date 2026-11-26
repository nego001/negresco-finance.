"""API35 chooser-only target discovery; synthetic isolated CI, no raw UI logs."""
import re
import time
import subprocess
import xml.etree.ElementTree as ET
import guardiao_pdf_ui_emulator_smoke as base

LABEL = "Negresco PDF Receiver LAB"
COMPONENT = "com.negresco.pdfreceiver.lab/.ReceiverActivity"
PACKAGES = frozenset(("android", "com.android.intentresolver", "com.google.android.intentresolver", "com.android.systemui"))
BOUNDS = base.BOUNDS

def rect(raw, w, h):
    m = BOUNDS.fullmatch(raw) if isinstance(raw, str) else None
    if not m:
        return None
    x1,y1,x2,y2 = map(int,m.groups())
    if not (0 <= x1 < x2 <= w and 0 <= y1 < y2 <= h):
        return None
    return x1,y1,x2,y2

def inspect(nodes,w,h):
    if type(nodes) is not list or len(nodes)>2500 or type(w) is not int or type(h) is not int or not (200<=w<=5000 and 200<=h<=5000):
        return "invalid-snapshot",None,None
    if any(type(n) is not dict for n in nodes):
        return "invalid-snapshot",None,None
    matches=[n for n in nodes if n.get("package") in PACKAGES and LABEL in (n.get("text"),n.get("content-desc"))]
    # Exact same label/text and content-description can describe one target;
    # require one geometrically identical clickable ancestor for all labels.
    if matches:
        if any(n.get("enabled")!="true" for n in matches):
            return "target-disabled",None,None
        ancestors={n.get("_tap_bounds","") for n in matches}
        if len(ancestors)!=1:
            return "target-ambiguous",None,None
        raw=next(iter(ancestors))
        bounds=rect(raw,w,h)
        parents=[n for n in nodes if n.get("package") in PACKAGES and n.get("clickable")=="true" and n.get("enabled")=="true" and n.get("bounds")==raw and n.get("_tap_bounds")==raw]
        if bounds is None or len(parents)!=1:
            return "target-parent-unconfirmed",None,None
        x1,y1,x2,y2=bounds
        if (x2-x1)<16 or (y2-y1)<16 or (x2-x1)*(y2-y1)>w*h//2:
            return "target-parent-unsafe",None,None
        eligible=[]
        for n in matches:
            b=rect(n.get("bounds"),w,h)
            if b and x1<=b[0]<b[2]<=x2 and y1<=b[1]<b[3]<=y2 and int(h*.13)<(b[1]+b[3])//2<int(h*.88):
                eligible.append(n)
        if eligible:
            # Reject multiple different label locations instead of guessing.
            if len({n["bounds"] for n in eligible})!=1:
                return "target-label-ambiguous",None,None
            target=eligible[0]
            center=((int(BOUNDS.fullmatch(target["bounds"]).group(1))+int(BOUNDS.fullmatch(target["bounds"]).group(3)))//2,(int(BOUNDS.fullmatch(target["bounds"]).group(2))+int(BOUNDS.fullmatch(target["bounds"]).group(4)))//2)
            for n in nodes:
                if n is parents[0] or n.get("clickable")!="true":
                    continue
                other=rect(n.get("bounds"),w,h)
                if other and other[0]<=center[0]<=other[2] and other[1]<=center[1]<=other[3]:
                    # Ancestors encompassing the whole chooser are not accepted as overlapping targets either.
                    return "target-overlapped",None,None
            return "target-exact",target,None
        category="target-outside-safe-band"
    else:
        category="target-not-observed"
    regions={r for n in nodes if n.get("package") in PACKAGES and n.get("scrollable")=="true" and n.get("enabled")=="true" and (r:=rect(n.get("bounds"),w,h)) is not None and r[2]-r[0]>=w//3 and r[3]-r[1]>=h//8}
    return category,None,next(iter(regions)) if len(regions)==1 else None

def receiver_registered():
    raw=base.adb("shell","cmd","package","query-activities","--brief","-a","android.intent.action.SEND","-t","application/pdf",timeout=15)
    return any(line.strip() in (COMPONENT,"com.negresco.pdfreceiver.lab/com.negresco.pdfreceiver.lab.ReceiverActivity") for line in raw.splitlines())

def find_receiver():
    if base.adb("shell","getprop","ro.build.version.sdk",timeout=15).strip()!="35":
        raise RuntimeError("API35 chooser scope required")
    if not receiver_registered():
        print("ENV (LAB): API35 PDF receiver registration unconfirmed",flush=True)
        raise RuntimeError("receiver registration unconfirmed")
    print("ENV (LAB): API35 PDF receiver registered",flush=True)
    scrolls=0
    previous=None
    for _ in range(12):
        if not base.chooser_present():
            raise RuntimeError("chooser foreground lost")
        try:
            w,h=base.screen_size()
            category,target,region=inspect(base.xml_nodes(),w,h)
        except (RuntimeError,ET.ParseError,subprocess.TimeoutExpired):
            category,target,region="snapshot-unavailable",None,None
        print("ENV (LAB): API35 chooser "+category,flush=True)
        if target is not None:
            identity=(target["bounds"],target["_tap_bounds"])
            if previous==identity and base.chooser_present():
                return target
            previous=identity
        else:
            previous=None
            if category in ("target-ambiguous","target-disabled","target-parent-unconfirmed","target-parent-unsafe","target-label-ambiguous","target-overlapped"):
                raise RuntimeError("unsafe chooser target")
            if region is not None and scrolls<3:
                if not base.chooser_present():
                    raise RuntimeError("chooser foreground lost")
                x1,y1,x2,y2=region
                x=(x1+x2)//2
                y0=y1+3*(y2-y1)//4
                y1=y1+(y2-y1)//4
                base.adb("shell","input","swipe",str(x),str(y0),str(x),str(y1),"300")
                scrolls+=1
                print("ENV (LAB): API35 chooser observed-scroll-region gesture",flush=True)
        time.sleep(.65)
    raise RuntimeError("API35 exact chooser receiver not confirmed")
