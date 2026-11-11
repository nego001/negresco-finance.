#!/usr/bin/env python3
"""API28 Debug-only guarded navigation Pix preview to Home in one process.

No PDF action, synthetic input, taps, swipes, screenshots, raw UI XML/logcat
publication, release change, account data, approval, or external network.
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


def guarded_preview_navigation() -> None:
    """Only Pix DEMO then Home; 2 validated gestures, same PID throughout."""
    before=same_process.observed_single_app_pid()
    assert_preview_pid(before)
    if BASE.lookup("Seu universo") is None:
        raise RuntimeError("preview-initial-home-unconfirmed")
    require_geometry_for_navigation()
    transitions=(
        ("home","pix","Pix do seu jeito."),
        ("pix","home","Seu universo"),
    )
    completed=0
    for current,target,expected_banner in transitions:
        assert_preview_pid(before)
        require_geometry_for_navigation()
        width,height=BASE.screen_size()
        first=safe_tab_point(BASE.xml_nodes(),width,height,BASE.PACKAGE,
                             current,target)
        time.sleep(.35)
        second=safe_tab_point(BASE.xml_nodes(),width,height,BASE.PACKAGE,
                              current,target)
        if first is None or second is None or first!=second:
            raise RuntimeError("preview-target-not-unique-stable-safe")
        assert_preview_pid(before)
        if completed>=MAX_GESTURES:
            raise RuntimeError("preview-gesture-budget-exhausted")
        BASE.adb("shell","input","tap",str(second[0]),str(second[1]),
                 timeout=10)
        completed+=1
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
            raise RuntimeError("preview-navigation-state-unconfirmed")
        print("PASS (LAB): Debug preview transition "+
              ("Home-to-Pix" if target=="pix" else "Pix-to-Home")
              +" in unchanged process",flush=True)
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
    except Exception:
        print("BLOCK (LAB): native ancestor geometry proof incomplete",
              file=sys.stderr)
        raise SystemExit(1)
