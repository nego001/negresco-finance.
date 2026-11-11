#!/usr/bin/env python3
"""API28 Debug-only bottom-inset offset A/B versus original native bounds.

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
        print("PASS (LAB): Debug inset-offset A/B measured; NO navigation or tap approval", flush=True)
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
