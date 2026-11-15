#!/usr/bin/env python3
"""Read-only initial-home geometry of EXACT root-bottom-inset Release candidate.

No financial input, native PDF, chooser, touch, swipe, back, force-stop, data
clear or production release. Only fixed, non-private categories are printed.
Do NOT approve a gesture based only on home geometry classifications.
"""
from __future__ import annotations
import sys
import guardiao_candidate_release_root_v4_api28_pdf_lab as candidate
import guardiao_original_release_same_process_lab as home
import guardiao_android_export_pdf_text_emulator_smoke as semantic

BASE = candidate.BASE
VALID = ("home-label-bounded", "on-bottom-band",
         "geometry-eligible", "siblings-both-regular")

def classify(nodes: object, width: object, height: object) -> tuple[str, str, str, str]:
    if (type(nodes) is not list or len(nodes) > 2500 or
            type(width) is not int or type(height) is not int or
            not 200 <= width <= 5000 or not 200 <= height <= 5000):
        return ("home-layout-unconfirmed", "unconfirmed",
                "unconfirmed", "unconfirmed")
    try:
        layout = home.safe_home_layout_snapshot_category(nodes, width, height)
        label, ancestor, siblings = home.safe_initial_home_detail(nodes,width,height)
        allow = (("home-label-bounded","three-tabs-thin",
                  "home-layout-unconfirmed","home-label-unconfirmed",
                  "home-bounds-unconfirmed"),
                 ("on-bottom-band","point-only","zero-area","offscreen",
                  "onscreen-other-band","unconfirmed"),
                 ("geometry-eligible","height-too-small","bounds-degenerate",
                  "bounds-offscreen","top-outside-bottom-tab","bottom-too-low",
                  "width-too-small","width-too-large","height-too-large",
                  "bounds-unconfirmed","viewport-unconfirmed"),
                 ("siblings-both-regular","siblings-both-thin",
                  "siblings-mixed-height","siblings-missing-or-ambiguous",
                  "siblings-bounds-unconfirmed","siblings-offscreen-or-degenerate",
                  "siblings-shared-region","siblings-package-mismatch",
                  "package-unconfirmed","home-bounds-unconfirmed",
                  "viewport-unconfirmed"))
        return tuple(v if v in group else "unconfirmed"
                     for v,group in zip((layout,label,ancestor,siblings),allow))
    except Exception:
        return ("home-layout-unconfirmed","unconfirmed","unconfirmed","unconfirmed")


# Passive-only diagnostic; never chooses touch coordinates or authorizes input.
# Counts exact known UI labels but emits only zero/one/multiple categories.
def sibling_inventory(nodes: object, width: object, height: object) -> dict[str, tuple[str,str,str]]:
    result = {name: ("unconfirmed","unconfirmed","unconfirmed")
              for name in ("Pix","Negresco")}
    if (type(nodes) is not list or len(nodes)>2500 or
            type(width) is not int or type(height) is not int or
            not (200<=width<=5000 and 200<=height<=5000)):
        return result
    homes=[n for n in nodes if type(n) is dict
           and n.get("class")=="android.widget.TextView"
           and n.get("enabled")=="true"
           and (n.get("text")=="Início" or n.get("content-desc")=="Início")]
    if len(homes)!=1 or not homes[0].get("package"):
        return result
    package=homes[0]["package"]
    def cat(items: list[dict[str,str]]) -> str:
        return "none" if not items else "one" if len(items)==1 else "multiple"
    for name in ("Pix","Negresco"):
        found=[n for n in nodes if type(n) is dict
               and n.get("class")=="android.widget.TextView"
               and n.get("enabled")=="true"
               and (n.get("text")==name or n.get("content-desc")==name)]
        same=[n for n in found if n.get("package")==package]
        eligible=[]
        for n in same:
            tap=n.get("_tap_bounds","")
            if home.safe_ancestor_constraint_category(tap,width,height)!="geometry-eligible":
                continue
            label=BASE.BOUNDS.fullmatch(n.get("bounds",""))
            bound=BASE.BOUNDS.fullmatch(tap)
            if label is None or bound is None:
                continue
            lx1,ly1,lx2,ly2=map(int,label.groups())
            x1,y1,x2,y2=map(int,bound.groups())
            if not (x1<=lx1<=lx2<=x2 and y1<=ly1<=ly2<=y2):
                continue
            parent=[p for p in nodes if type(p) is dict
                    and p.get("bounds")==tap and p.get("clickable")=="true"
                    and p.get("enabled")=="true" and p.get("package")==package]
            if len(parent)!=1:
                continue
            eligible.append(n)
        result[name]=(cat(found),cat(same),cat(eligible))
    return result

def run() -> None:
    if len(sys.argv)!=1 or not candidate.candidate_identity(candidate.APK):
        raise RuntimeError("candidate hash does not match")
    if (BASE.adb("shell","getprop","ro.build.version.sdk",timeout=15).strip()!="28"
            or semantic.REPORT.exists() or BASE.REPORT.exists()):
        raise RuntimeError("environment or stale receipt unconfirmed")
    BASE.APK, BASE.EXPECTED_SHA=candidate.APK,candidate.PINNED_CANDIDATE
    BASE.adb("install","-r",str(candidate.APK),timeout=150)
    result=BASE.adb("shell","monkey","-p",BASE.PACKAGE,
                    "-c","android.intent.category.LAUNCHER","1",timeout=30)
    if "Events injected: 1" not in result:
        raise RuntimeError("app launch unconfirmed")
    BASE.wait_visible("Seu universo",retries=45)
    pid=home.observed_single_app_pid()
    if not pid:
        raise RuntimeError("single app PID unconfirmed")
    width,height=BASE.screen_size()
    first=classify(BASE.xml_nodes(),width,height)
    second=classify(BASE.xml_nodes(),width,height)
    if home.observed_single_app_pid()!=pid:
        raise RuntimeError("initial Home process changed")
    for name,value in zip(("layout","label","ancestor","siblings"),second):
        print("ENV (LAB): initial-root-bottom-inset-"+name+"="+value,flush=True)
    # Additional read-only snapshot to distinguish duplicate content labels
    # from a uniquely bounded clickable bottom-tab candidate. No XML logging.
    inventory=sibling_inventory(BASE.xml_nodes(),width,height)
    if home.observed_single_app_pid()!=pid:
        raise RuntimeError("sibling audit PID changed")
    for name,key in (("Pix","pix"),("Negresco","negresco")):
        total,same,eligible=inventory[name]
        print("ENV (LAB): sibling-audit-"+key+"-all="+total+
              " package="+same+" bounded-unique-parent="+eligible,flush=True)
    if first!=second or second!=VALID:
        raise RuntimeError("safe initial Home geometry not confirmed in two observations")
    if BASE.lookup("Gerar e compartilhar relatório PDF") is not None:
        raise RuntimeError("unexpected export action on Home screen")
    print("PASS (LAB): bounded initial Home geometry in root-bottom-inset Release candidate",flush=True)
    print("PASS (LAB): no navigation gesture, PDF or financial operation attempted",flush=True)

if __name__=="__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): root-bottom-inset Release candidate Home geometry unverified",
              file=sys.stderr)
        raise SystemExit(1)
