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
