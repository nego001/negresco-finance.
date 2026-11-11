#!/usr/bin/env python3
"""API28 Debug-only categorical RN touch delivery audit plus guarded navigation.

Exactly two permitted geometry-gated preview taps; no PDF, real payment,
swipes, screenshots, raw XML/logcat publication, or release change.
"""
from __future__ import annotations

import os
import re
import signal
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

import guardiao_pdf_debug_metro_lab as debug
import guardiao_original_release_same_process_lab as same_process
import guardiao_debug_native_dispatch_probe as native_dispatch

BASE = debug.base
TARGETS = (
    "negresco-lab-tab-home", "negresco-lab-tab-pix",
    "negresco-lab-tab-negresco",
)
PRIVATE_DEVICE_XML = "/sdcard/negresco_native_ancestor_lab.xml"
MAX_XML_BYTES = 2_000_000


def rect(node: dict[str, str], w: int, h: int) -> tuple[int, int, int, int] | None:
    match = BASE.BOUNDS.fullmatch(node.get("bounds", ""))
    if not match:
        return None
    x1, y1, x2, y2 = map(int, match.groups())
    if 0 <= x1 < x2 <= w and 0 <= y1 < y2 <= h:
        return (x1, y1, x2, y2)
    return None


def classify_native_ancestors(xml: str, w: int, h: int) -> str:
    """Only fixed categories, never node data, coordinates or raw hierarchy."""
    if not isinstance(xml, str) or len(xml) > MAX_XML_BYTES or not (w > 0 and h > 0):
        return "native-tree-unconfirmed"
    try:
        root = ET.fromstring(xml.lstrip("\ufeff"))
        found: dict[str, list[tuple[dict[str, str], tuple[dict[str, str], ...]]]] = {
            key: [] for key in TARGETS
        }

        def walk(el: ET.Element, ancestors: tuple[dict[str, str], ...]) -> None:
            if el.tag == "node":
                node = dict(el.attrib)
                for key in TARGETS:
                    if debug.safe_testid_matches(node, key):
                        found[key].append((node, ancestors))
                ancestors += (node,)
            for child in el:
                walk(child, ancestors)

        walk(root, ())
        if any(len(matches) != 1 for matches in found.values()):
            return "native-three-targets-unconfirmed"

        status = []
        packages = set()
        for key in TARGETS:
            node, ancestors = found[key][0]
            if node.get("clickable") != "true" or node.get("enabled") != "true":
                return "native-clickability-unconfirmed"
            package = node.get("package", "")
            if not package:
                return "native-package-unconfirmed"
            packages.add(package)
            target = rect(node, w, h)
            if target is None:
                return "native-target-rect-unconfirmed"
            th = target[3] - target[1]
            if th >= int(h * .025):
                return "native-target-not-thin"
            parent_rects = [
                r for a in ancestors if a.get("package") == package
                if (r := rect(a, w, h)) is not None
            ]
            # A true ancestor must contain the target, and be nearby in
            # the bottom screen band; large full-screen ancestors do not count.
            larger = any(
                r[0] <= target[0] and r[1] <= target[1]
                and r[2] >= target[2] and r[3] >= target[3]
                and r[1] > int(h * .60)
                and r[3] < int(h * .985)
                and (r[3] - r[1]) >= max(2 * th, int(h * .045))
                for r in parent_rects
            )
            status.append("taller-parent" if larger else "no-taller-parent")
        if len(packages) != 1:
            return "native-package-mismatch"
        if all(s == "taller-parent" for s in status):
            return "native-three-thin-with-taller-bottom-ancestors"
        if all(s == "no-taller-parent" for s in status):
            return "native-three-thin-no-taller-bottom-ancestors"
        return "native-three-thin-mixed-ancestors"
    except (ValueError, ET.ParseError, TypeError, RecursionError):
        return "native-tree-unconfirmed"


def collect_native_tree(w: int, h: int) -> str:
    try:
        BASE.adb("shell", "uiautomator", "dump", PRIVATE_DEVICE_XML, timeout=35)
        raw = BASE.adb("exec-out", "cat", PRIVATE_DEVICE_XML, timeout=15)
        return classify_native_ancestors(raw, w, h)
    except Exception:
        return "native-tree-collection-unconfirmed"
    finally:
        # This is a disposable diagnostic hierarchy, not user evidence.
        BASE.adb("shell", "rm", "-f", PRIVATE_DEVICE_XML, timeout=12, check=False)


def bounded_native_window_proof(native: str, window: str, frame: str) -> bool:
    """Only categorically valid, fully visible non-overlapping targets qualify.

    No gestures are authorized by this function. It is not navigation QA.
    """
    return (
        native == "testid-three-targets-bounded-readonly"
        and window == "window-three-regular-in-viewport"
        and frame in (
            "rootframe-all-inside-window-not-below",
            "rootframe-all-inside-window-inset-sized",
        )
    )


TAB_IDS = {
    "home": "negresco-lab-tab-home",
    "pix": "negresco-lab-tab-pix",
    "negresco": "negresco-lab-tab-negresco",
}
MAX_GESTURES = 2


def safe_tab_point(nodes: list[dict[str,str]], width: int, height: int,
                   package: str, current: str, target: str
                   ) -> tuple[int,int] | None:
    """Fail closed: unique selected tabs, non-overlap, no other click target.

    Coordinates stay private and ephemeral. This is exclusively a Debug
    fixture action, not a financial screen automation facility.
    """
    if (current not in ("home","pix") or target not in ("home","pix")
            or target == current or width <= 0 or height <= 0 or not package
            or len(nodes) > 3000):
        return None
    selected: dict[str,dict[str,str]] = {}
    rects: dict[str,tuple[int,int,int,int]] = {}
    for key, ident in TAB_IDS.items():
        found = [n for n in nodes if debug.safe_testid_matches(n,ident)]
        if len(found)!=1:
            return None
        node=found[0]
        if (node.get("package") != package
                or node.get("clickable") != "true"
                or node.get("enabled") != "true"
                or node.get("selected") != ("true" if key==current else "false")
                or same_process.safe_ancestor_constraint_category(
                    node.get("bounds",""),width,height) != "geometry-eligible"):
            return None
        match=BASE.BOUNDS.fullmatch(node.get("bounds",""))
        if match is None:
            return None
        selected[key]=node
        rects[key]=tuple(map(int,match.groups()))
    if len(set(rects.values()))!=3:
        return None
    for i,key in enumerate(TAB_IDS):
        a=rects[key]
        for other in list(TAB_IDS)[i+1:]:
            b=rects[other]
            if a[0]<b[2] and b[0]<a[2] and a[1]<b[3] and b[1]<a[3]:
                return None
    a=rects[target]
    point=((a[0]+a[2])//2,(a[1]+a[3])//2)
    for node in nodes:
        if (node is selected[target] or node.get("package")!=package
                or node.get("clickable")!="true"
                or node.get("enabled")!="true"):
            continue
        candidate=BASE.BOUNDS.fullmatch(node.get("bounds",""))
        if candidate is None:
            return None
        x1,y1,x2,y2=map(int,candidate.groups())
        if x1<=point[0]<=x2 and y1<=point[1]<=y2:
            return None
    return point


# Log only allowlisted phase and result categories, never private Android state.
NAV_PHASE = "not-started"
NAV_PHASES = frozenset((
    "before-pid", "initial-home", "initial-geometry",
    "before-target", "target-snapshots", "before-gesture",
    "post-gesture-state", "roundtrip-final",
))
NAV_BLOCK_CODES = {
    "preview-process-or-focus-unconfirmed": "process-or-focus-unconfirmed",
    "preview-initial-home-unconfirmed": "initial-home-unconfirmed",
    "preview-navigation-geometry-unconfirmed": "geometry-unconfirmed",
    "preview-target-not-unique-stable-safe": "target-safety-unconfirmed",
    "preview-gesture-budget-exhausted": "gesture-budget-exhausted",
    "preview-navigation-state-unconfirmed": "navigation-state-unconfirmed",
    "preview-navigation-count-unconfirmed": "navigation-count-unconfirmed",
    "preview-telemetry-unconfirmed": "telemetry-unconfirmed",
    "stable inset-offset bounds unconfirmed": "native-bounds-unconfirmed",
    "stable window-measure evidence unconfirmed": "window-unconfirmed",
    "root/window independent frame category unconfirmed": "root-frame-unconfirmed",
    "bounded native target window proof rejected": "bounds-or-frame-rejected",
}


def mark_navigation_phase(category: str) -> None:
    global NAV_PHASE
    if category not in NAV_PHASES:
        raise RuntimeError("unrecognized navigation phase")
    NAV_PHASE = category
    print("STAGE (LAB): preview-navigation-" + category, flush=True)


def safe_navigation_block_reason(exc: BaseException) -> str:
    if type(exc) is not RuntimeError:
        return "other-or-unconfirmed"
    return NAV_BLOCK_CODES.get(str(exc), "other-or-unconfirmed")


def safe_tab_preflight_category(
    nodes: list[dict[str,str]], width: int, height: int,
    package: str, current: str, target: str
) -> str:
    """Passive category for the exact safe_tab_point gates; no targets emitted."""
    try:
        if (not isinstance(nodes,list) or len(nodes)>3000
                or current not in ("home","pix") or target not in ("home","pix")
                or target==current or width<=0 or height<=0 or not package):
            return "preflight-input-unconfirmed"
        seen={}
        rects={}
        for key,ident in TAB_IDS.items():
            matches=[n for n in nodes if debug.safe_testid_matches(n,ident)]
            if len(matches)!=1:
                return "target-ids-unconfirmed"
            node=matches[0]
            if (node.get("package")!=package or node.get("clickable")!="true"
                    or node.get("enabled")!="true"):
                return "target-package-or-clickability"
            if node.get("selected") not in ("true","false"):
                return "target-selected-attribute-missing"
            if node.get("selected")!=("true" if key==current else "false"):
                return "target-selected-state-mismatch"
            if same_process.safe_ancestor_constraint_category(
                    node.get("bounds",""),width,height)!="geometry-eligible":
                return "target-geometry-not-eligible"
            match=BASE.BOUNDS.fullmatch(node.get("bounds",""))
            if match is None:
                return "target-bounds-unconfirmed"
            seen[key]=node
            rects[key]=tuple(map(int,match.groups()))
        if len(set(rects.values()))!=3:
            return "targets-shared-region"
        for i,key in enumerate(TAB_IDS):
            a=rects[key]
            for other in list(TAB_IDS)[i+1:]:
                b=rects[other]
                if a[0]<b[2] and b[0]<a[2] and a[1]<b[3] and b[1]<a[3]:
                    return "targets-overlap"
        target_rect=rects[target]
        cx=(target_rect[0]+target_rect[2])//2
        cy=(target_rect[1]+target_rect[3])//2
        for node in nodes:
            if (node is seen[target] or node.get("package")!=package
                    or node.get("clickable")!="true"
                    or node.get("enabled")!="true"):
                continue
            match=BASE.BOUNDS.fullmatch(node.get("bounds",""))
            if match is None:
                return "other-clickable-bounds-unconfirmed"
            x1,y1,x2,y2=map(int,match.groups())
            if x1<=cx<=x2 and y1<=cy<=y2:
                return "other-clickable-covers-target"
        return "target-preflight-eligible"
    except Exception:
        return "target-preflight-unconfirmed"


def assert_preview_pid(expected: str) -> None:
    """App focus and stable PID must hold at every gesture and observation."""
    if (not expected or same_process.observed_single_app_pid()!=expected
            or BASE.safe_environment_summary().get("foregroundCategory")
            != "negresco-app"):
        raise RuntimeError("preview-process-or-focus-unconfirmed")


def require_geometry_for_navigation() -> None:
    if (debug.safe_debug_testid_nav_geometry()
            != "testid-three-targets-bounded-readonly"
            or debug.safe_debug_testid_yoga_category()
            != "testid-yoga-all-regular"
            or debug.safe_debug_window_measure_category()
            != "window-three-regular-in-viewport"
            or debug.safe_debug_window_root_frame_category()
            != "rootframe-all-inside-window-not-below"):
        raise RuntimeError("preview-navigation-geometry-unconfirmed")


def safe_postgesture_category(
    nodes: list[dict[str,str]], current: str, target: str,
    banner: str, native_category: str
) -> str:
    """Categorize a failed preview transition using only allowlisted strings.

    Does not authorize a retry or a further gesture. Never returns UI data.
    """
    try:
        if (not isinstance(nodes,list) or not nodes or len(nodes)>3000
                or (current,target,banner) not in (
                    ("home","pix","Pix do seu jeito."),
                    ("pix","home","Seu universo"),
                )):
            return "post-snapshot-unconfirmed"
        def visible(text: str) -> bool:
            return any(
                n.get("package")==BASE.PACKAGE
                and n.get("enabled")=="true"
                and any(text.casefold() in n.get(field,"").casefold()
                        for field in ("text","content-desc"))
                for n in nodes
            )
        if not visible(banner):
            source_banner=("Seu universo" if current=="home"
                           else "Pix do seu jeito.")
            return ("post-source-screen-retained" if visible(source_banner)
                    else "post-expected-screen-unconfirmed")
        found={}
        for key,ident in TAB_IDS.items():
            hits=[n for n in nodes if debug.safe_testid_matches(n,ident)]
            if len(hits)!=1:
                return "post-screen-visible-target-ids-unconfirmed"
            found[key]=hits[0]
        if any(n.get("package")!=BASE.PACKAGE
               or n.get("clickable")!="true"
               or n.get("enabled")!="true" for n in found.values()):
            return "post-screen-visible-target-state-unconfirmed"
        states=[node.get("selected") for node in found.values()]
        if any(state not in ("true","false") for state in states):
            return "post-screen-visible-selection-attribute-missing"
        if any(node.get("selected")!=("true" if key==target else "false")
               for key,node in found.items()):
            return "post-screen-visible-selection-mismatch"
        if native_category!="testid-three-targets-bounded-readonly":
            return "post-screen-selected-bounds-unconfirmed"
        return "post-screen-selected-geometry-consistent"
    except Exception:
        return "post-snapshot-unconfirmed"


# Read only fixed Dev-only markers. Logcat stays local and is never published.
LAB_LOG_MARKERS = frozenset((
    "NEGRESCO_LAB_NAV_PAGE_HOME",
    "NEGRESCO_LAB_NAV_PAGE_PIX",
    "NEGRESCO_LAB_NAV_TOUCHIN_PIX",
    "NEGRESCO_LAB_NAV_CALL_PIX",
    "NEGRESCO_LAB_NAV_BOTTOM_TOUCH_START",
))


def safe_lab_logcat() -> str | None:
    try:
        raw=BASE.adb("logcat","-d","-t","2500","-s",
                     "ReactNativeJS:I","*:S",timeout=18,check=False)
        if not isinstance(raw,str) or not (0 < len(raw) <= 2_500_000):
            return None
        return raw
    except Exception:
        return None


def classify_pix_touch_delivery(raw: str | None) -> str:
    """Only allowlisted signals; never output logcat text or raw identifiers."""
    if raw is None:
        return "delivery-telemetry-unconfirmed"
    markers=set(re.findall(r"NEGRESCO_LAB_NAV_(?:PAGE_HOME|PAGE_PIX|TOUCHIN_PIX|CALL_PIX)",raw))
    if "NEGRESCO_LAB_NAV_PAGE_PIX" in markers:
        if "NEGRESCO_LAB_NAV_CALL_PIX" in markers:
            if "NEGRESCO_LAB_NAV_TOUCHIN_PIX" in markers:
                return "delivery-pressin-call-and-pix-render"
            return "delivery-call-and-pix-render-without-pressin"
        return "delivery-pix-render-without-call"
    if "NEGRESCO_LAB_NAV_CALL_PIX" in markers:
        return "delivery-handler-without-pix-render"
    if "NEGRESCO_LAB_NAV_TOUCHIN_PIX" in markers:
        return "delivery-pressin-without-handler"
    return "delivery-no-pressin-or-handler-observed"


# Native read-only proof does not depend on RN logcat transport.
NATIVE_NAV_STATE = re.compile(
    r"negresco-lab-rn-page-(home|pix|other)-pressin-(yes|no)-call-(yes|no)"
    r"-rootstart-(yes|no)-bottomstart-(yes|no)"
)


def native_nav_marker(nodes: list[dict[str,str]]) -> tuple[str,str,str,str,str] | None:
    """Return only allowlisted categories for one exact Debug node and package."""
    if not isinstance(nodes,list) or not (0 < len(nodes) <= 3000):
        return None
    matches=[]
    for node in nodes:
        if not isinstance(node,dict):
            return None
        suffix=node.get("resource-id","").rsplit("/",1)[-1]
        marker=NATIVE_NAV_STATE.fullmatch(suffix)
        if marker is not None:
            if node.get("package")!=BASE.PACKAGE:
                return None
            matches.append(marker.groups())
    return matches[0] if len(matches)==1 else None


def classify_nav_native_state(nodes: list[dict[str,str]]) -> str:
    """Existing navigation proof; root/bottom are independent, passive evidence."""
    marker=native_nav_marker(nodes)
    if marker is None:
        return "native-state-unconfirmed"
    page,pressin,call,_,_=marker
    return "native-page-"+page+"-pressin-"+pressin+"-call-"+call


def classify_native_touch_route(nodes: list[dict[str,str]]) -> str:
    """Separate Root/Bottom listeners, no coordinates or user content."""
    marker=native_nav_marker(nodes)
    if marker is None:
        return "route-native-unconfirmed"
    _,_,_,root,bottom=marker
    return "route-native-root-"+root+"-bottom-"+bottom


def classify_pix_touch_path(raw: str | None) -> str:
    """Categorical Debug listener on the bottom View, never a touch authorization."""
    if raw is None:
        return "route-telemetry-unconfirmed"
    observed=re.search(
        r"(?<![A-Za-z0-9_-])NEGRESCO_LAB_NAV_BOTTOM_TOUCH_START(?![A-Za-z0-9_-])",
        raw,
    ) is not None
    return ("route-bottom-touch-observed" if observed
            else "route-no-rn-touch-observed")


def prepare_pix_touch_telemetry() -> bool:
    initial=BASE.xml_nodes()
    native=classify_nav_native_state(initial)
    root_bottom=classify_native_touch_route(initial)
    print("ENV (LAB): Pix preflight native RN category="+native,flush=True)
    print("ENV (LAB): Pix preflight native touch route="+root_bottom,flush=True)
    if (native!="native-page-home-pressin-no-call-no"
            or root_bottom!="route-native-root-no-bottom-no"):
        raise RuntimeError("preview-telemetry-unconfirmed")
    dispatch_before=native_dispatch.read_debug_native_state(BASE.adb,BASE.PACKAGE)
    print("ENV (LAB): Pix native Activity dispatch preflight="+dispatch_before,flush=True)
    scroll_before=native_dispatch.read_debug_scroll_state(BASE.adb,BASE.PACKAGE)
    print("ENV (LAB): Pix native scroll coverage preflight="+scroll_before,flush=True)
    if dispatch_before!="activity-ready" or scroll_before!="scroll-ready":
        raise RuntimeError("preview-telemetry-unconfirmed")
    # Logcat is supplemental and cannot veto a native marker with valid geometry.
    raw=safe_lab_logcat()
    ready=raw is not None and "NEGRESCO_LAB_NAV_PAGE_HOME" in raw
    print("ENV (LAB): Pix logcat baseline="+
          ("available" if ready else "unconfirmed"),flush=True)
    if ready:
        BASE.adb("logcat","-c",timeout=12,check=False)
    return ready


def observed_pix_logcat_category(ready: bool) -> str:
    if not ready:
        return "delivery-telemetry-unconfirmed"
    return classify_pix_touch_delivery(safe_lab_logcat())


def guarded_preview_navigation() -> None:
    """Only Pix DEMO then Home; 2 validated gestures, same PID throughout."""
    mark_navigation_phase("before-pid")
    before=same_process.observed_single_app_pid()
    assert_preview_pid(before)
    mark_navigation_phase("initial-home")
    if BASE.lookup("Seu universo") is None:
        raise RuntimeError("preview-initial-home-unconfirmed")
    mark_navigation_phase("initial-geometry")
    require_geometry_for_navigation()
    transitions=(
        ("home","pix","Pix do seu jeito."),
        ("pix","home","Seu universo"),
    )
    completed=0
    logcat_ready=False
    for current,target,expected_banner in transitions:
        mark_navigation_phase("before-target")
        assert_preview_pid(before)
        require_geometry_for_navigation()
        mark_navigation_phase("target-snapshots")
        width,height=BASE.screen_size()
        nodes_first=BASE.xml_nodes()
        first=safe_tab_point(nodes_first,width,height,BASE.PACKAGE,current,target)
        time.sleep(.35)
        nodes_second=BASE.xml_nodes()
        second=safe_tab_point(nodes_second,width,height,BASE.PACKAGE,current,target)
        if first is None or second is None or first!=second:
            print("ENV (LAB): Preview safe-target first="
                  +safe_tab_preflight_category(
                      nodes_first,width,height,BASE.PACKAGE,current,target)
                  +" second="
                  +safe_tab_preflight_category(
                      nodes_second,width,height,BASE.PACKAGE,current,target),
                  flush=True)
            raise RuntimeError("preview-target-not-unique-stable-safe")
        mark_navigation_phase("before-gesture")
        assert_preview_pid(before)
        if completed==0 and current=="home" and target=="pix":
            logcat_ready=prepare_pix_touch_telemetry()
        if completed>=MAX_GESTURES:
            raise RuntimeError("preview-gesture-budget-exhausted")
        BASE.adb("shell","input","tap",str(second[0]),str(second[1]),
                 timeout=10)
        completed+=1
        mark_navigation_phase("post-gesture-state")
        reached=False
        for _ in range(8):
            assert_preview_pid(before)
            if BASE.lookup(expected_banner) is not None:
                nodes=BASE.xml_nodes()
                expected=[n for n in nodes
                          if debug.safe_testid_matches(n,TAB_IDS[target])]
                other=[n for n in nodes
                       if debug.safe_testid_matches(n,TAB_IDS[current])]
                if (len(expected)==1 and len(other)==1
                        and expected[0].get("selected")=="true"
                        and other[0].get("selected")=="false"
                        and debug.safe_debug_testid_nav_geometry()
                        =="testid-three-targets-bounded-readonly"):
                    reached=True
                    break
            time.sleep(.65)
        if not reached:
            # Extra read-only observation only after the original gate blocks.
            # Never retry a gesture or relax the banner/selection check.
            try:
                terminal_nodes=BASE.xml_nodes()
            except Exception:
                terminal_nodes=[]
            terminal_native=debug.safe_debug_testid_nav_geometry()
            detail=safe_postgesture_category(
                terminal_nodes,current,target,expected_banner,terminal_native)
            print("ENV (LAB): Pix post-gesture screen category="+detail,
                  flush=True)
            print("ENV (LAB): Pix post-gesture native bounds="
                  +terminal_native,flush=True)
            print("ENV (LAB): Pix native Activity dispatch after gesture="
                  +native_dispatch.read_debug_native_state(BASE.adb,BASE.PACKAGE),
                  flush=True)
            print("ENV (LAB): Pix native scroll coverage after gesture="
                  +native_dispatch.read_debug_scroll_state(BASE.adb,BASE.PACKAGE),
                  flush=True)
            if current=="home" and target=="pix":
                print("ENV (LAB): Pix RN native touch delivery="
                      +classify_nav_native_state(terminal_nodes),flush=True)
                print("ENV (LAB): Pix RN native root/bottom route="
                      +classify_native_touch_route(terminal_nodes),flush=True)
                raw_touch_log=safe_lab_logcat() if logcat_ready else None
                print("ENV (LAB): Pix RN touch route="
                      +classify_pix_touch_path(raw_touch_log),flush=True)
                print("ENV (LAB): Pix RN logcat delivery="
                      +classify_pix_touch_delivery(raw_touch_log),flush=True)
            raise RuntimeError("preview-navigation-state-unconfirmed")
        # A displayed screen and selected tabs alone cannot attest JS event delivery.
        terminal_pass_nodes=BASE.xml_nodes()
        native_after=classify_nav_native_state(terminal_pass_nodes)
        print("ENV (LAB): Pix RN native touch delivery="+native_after,flush=True)
        print("ENV (LAB): Pix native Activity dispatch after gesture="
              +native_dispatch.read_debug_native_state(BASE.adb,BASE.PACKAGE),
              flush=True)
        print("ENV (LAB): Pix native scroll coverage after gesture="
              +native_dispatch.read_debug_scroll_state(BASE.adb,BASE.PACKAGE),
              flush=True)
        print("ENV (LAB): Pix RN native root/bottom route="
              +classify_native_touch_route(terminal_pass_nodes),flush=True)
        if native_after!=("native-page-pix-pressin-yes-call-yes" if target=="pix"
                         else "native-page-home-pressin-yes-call-yes"):
            raise RuntimeError("preview-navigation-state-unconfirmed")
        if target=="pix":
            raw_touch_log=safe_lab_logcat() if logcat_ready else None
            print("ENV (LAB): Pix RN touch route="
                  +classify_pix_touch_path(raw_touch_log),flush=True)
            print("ENV (LAB): Pix RN logcat delivery="
                  +classify_pix_touch_delivery(raw_touch_log),flush=True)
        print("PASS (LAB): Debug preview transition "+
              ("Home-to-Pix" if target=="pix" else "Pix-to-Home")
              +" in unchanged process",flush=True)
    mark_navigation_phase("roundtrip-final")
    assert_preview_pid(before)
    if completed!=MAX_GESTURES:
        raise RuntimeError("preview-navigation-count-unconfirmed")


def run() -> None:
    if len(sys.argv) != 1:
        raise RuntimeError("unexpected native ancestor lab argument")
    if debug.semantic.REPORT.exists() or BASE.REPORT.exists():
        raise RuntimeError("stale local PDF report found")
    digest = debug.debug_digest()
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise RuntimeError("debug APK sha unconfirmed")
    if BASE.adb("shell", "getprop", "ro.build.version.sdk").strip() != "28":
        raise RuntimeError("Android API28 not confirmed")
    server = None
    relay = None
    try:
        server = debug.start_local_metro()
        debug.prewarm_android_bundle()
        relay = debug.transport.PrivateMetroRelay()
        relay.start()
        BASE.adb("reverse", f"tcp:{debug.BUNDLE_PORT}",
                 f"tcp:{debug.transport.LISTEN_PORT}")
        relay.reset_after_preflight()
        BASE.adb("install", "-r", str(debug.APK), timeout=150)
        started = BASE.adb("shell", "monkey", "-p", BASE.PACKAGE,
                           "-c", "android.intent.category.LAUNCHER",
                           "1", timeout=30)
        if "Events injected: 1" not in started:
            raise RuntimeError("debug home launch unconfirmed")
        BASE.wait_visible("Seu universo", retries=45)
        print("STAGE (LAB): only Debug home screen observed", flush=True)
        if debug.safe_debug_testid_yoga_category() != "testid-yoga-all-regular":
            raise RuntimeError("Yoga category unconfirmed")
        if debug.safe_debug_bottom_placement_category() != "testid-bottom-inside-root":
            raise RuntimeError("root placement category unconfirmed")
        native_first = debug.safe_debug_testid_nav_geometry()
        time.sleep(.35)
        native_second = debug.safe_debug_testid_nav_geometry()
        print("ENV (LAB): Debug bottom-inset native target bounds=" + native_second,
              flush=True)
        native_allowed = (
            "testid-three-targets-thin",
            "testid-three-targets-bounded-readonly",
        )
        if native_first != native_second or native_second not in native_allowed:
            raise RuntimeError("stable inset-offset bounds unconfirmed")
        window_first = debug.safe_debug_window_measure_category()
        time.sleep(.35)
        window_second = debug.safe_debug_window_measure_category()
        root_first = debug.safe_debug_window_root_frame_category()
        root_second = debug.safe_debug_window_root_frame_category()
        print("ENV (LAB): Debug native measureInWindow category=" + window_second,
              flush=True)
        print("ENV (LAB): Debug window versus root frame=" + root_second, flush=True)
        allowed_root=(
            "rootframe-at-least-one-below","rootframe-at-least-one-above",
            "rootframe-at-least-one-side",
            "rootframe-all-inside-window-beyond-inset",
            "rootframe-all-inside-window-inset-sized",
            "rootframe-all-inside-window-not-below",
        )
        if root_first != root_second or root_second not in allowed_root:
            raise RuntimeError("root/window independent frame category unconfirmed")
        if window_first != window_second or window_second not in (
            "window-three-regular-in-viewport",
            "window-at-least-one-thin",
            "window-at-least-one-outside",
        ):
            raise RuntimeError("stable window-measure evidence unconfirmed")
        if native_second == "testid-three-targets-bounded-readonly":
            # Thin-ancestor classifier is purposely inapplicable once native
            # targets are adequately bounded. Still require the independent
            # window and root containment proof; DO NOT authorize a tap.
            if not bounded_native_window_proof(
                native_second, window_second, root_second
            ):
                raise RuntimeError("bounded native target window proof rejected")
            print("ENV (LAB): Debug bottom native ancestor category="
                  "not-applicable-target-bounded", flush=True)
        else:
            # Preserve the strict original diagnostic for genuinely thin
            # targets. A missing/ambiguous native XML snapshot blocks.
            w, h = BASE.screen_size()
            first = collect_native_tree(w, h)
            time.sleep(.35)
            second = collect_native_tree(w, h)
            print("ENV (LAB): Debug bottom native ancestor category=" + second,
                  flush=True)
            allow = (
                "native-three-thin-with-taller-bottom-ancestors",
                "native-three-thin-no-taller-bottom-ancestors",
                "native-three-thin-mixed-ancestors",
            )
            if first != second or second not in allow:
                raise RuntimeError("stable thin ancestor evidence unconfirmed")
        if BASE.lookup("Gerar e compartilhar relatório PDF") is not None:
            raise RuntimeError("unexpected PDF action on home")
        print("PASS (LAB): Debug inset-offset A/B geometry confirmed", flush=True)
        guarded_preview_navigation()
        print("PASS (LAB): two guarded Pix preview navigation gestures; same PID; no PDF", flush=True)
    finally:
        try:
            BASE.adb("reverse", "--remove", f"tcp:{debug.BUNDLE_PORT}", check=False)
        except Exception:
            pass
        if relay is not None:
            relay.stop()
        if server is not None and server.poll() is None:
            os.killpg(server.pid, signal.SIGTERM)
            try:
                server.wait(timeout=8)
            except subprocess.TimeoutExpired:
                os.killpg(server.pid, signal.SIGKILL)
                server.wait(timeout=4)


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        # Never reveal raw exceptions, focus state, PID, UI text or coordinates.
        phase=NAV_PHASE if NAV_PHASE in NAV_PHASES else "pre-navigation"
        reason=safe_navigation_block_reason(exc)
        print("BLOCK (LAB): Pix preview guarded navigation phase="+phase+
              " reason="+reason,file=sys.stderr)
        raise SystemExit(1)
