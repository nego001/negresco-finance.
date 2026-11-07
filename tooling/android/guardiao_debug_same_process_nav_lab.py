#!/usr/bin/env python3
"""Disposable API28 navigation proof after a verified synthetic PDF A.

Only one app navigation gesture, after safe bounds, process-identity, and
non-overlap gates. No second PDF; immutable original Release is untouched.
Never emit raw UI XML, coordinates, private values, PIDs or exceptions.
"""
from __future__ import annotations

import re
import sys
import time

import guardiao_pdf_debug_metro_lab as debug
import guardiao_android_export_pdf_text_emulator_smoke as semantic
import guardiao_original_release_same_process_lab as geometry

BASE = debug.base
TAB_IDS = ("negresco-lab-tab-home", "negresco-lab-tab-pix",
           "negresco-lab-tab-negresco")


def safe_home_target(nodes: list[dict[str, str]], width: int,
                     height: int, package: str) -> tuple[int, int] | None:
    """Return one verified in-memory target only; never log or publish it."""
    if width <= 0 or height <= 0 or not package:
        return None
    rects: dict[str, tuple[int, int, int, int]] = {}
    actual: dict[str, dict[str, str]] = {}
    for ident in TAB_IDS:
        hits = [n for n in nodes
                if n.get("resource-id", "").rsplit("/", 1)[-1] == ident]
        if len(hits) != 1:
            return None
        node = hits[0]
        if (node.get("package") != package or node.get("clickable") != "true"
                or node.get("enabled") != "true"):
            return None
        raw = node.get("bounds", "")
        if geometry.safe_ancestor_constraint_category(raw, width, height) != "geometry-eligible":
            return None
        bound = BASE.BOUNDS.fullmatch(raw)
        if bound is None:
            return None
        rects[ident] = tuple(map(int, bound.groups()))
        actual[ident] = node
    if len(set(rects.values())) != len(TAB_IDS):
        return None
    for i, a in enumerate(rects.values()):
        for b in list(rects.values())[i + 1:]:
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                return None
    home = actual[TAB_IDS[0]]
    # This navigation proof must start from Guardiao, not an already-selected Home.
    if home.get("selected") != "false":
        return None
    x1, y1, x2, y2 = rects[TAB_IDS[0]]
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    # Any other enabled, clickable widget covering the same point is unsafe.
    for item in nodes:
        if item is home or item.get("clickable") != "true" or item.get("enabled") != "true":
            continue
        bound = BASE.BOUNDS.fullmatch(item.get("bounds", ""))
        if bound is None:
            return None
        ax1, ay1, ax2, ay2 = map(int, bound.groups())
        if ax1 <= cx <= ax2 and ay1 <= cy <= ay2:
            return None
    return cx, cy


def assert_same_pid(expected: str) -> None:
    if not expected or geometry.observed_single_app_pid() != expected:
        raise RuntimeError("same-process-pid-unconfirmed")


def navigate_after_verified_pdf(before_pid: str) -> None:
    assert_same_pid(before_pid)
    # Returning to app foreground is an Android launcher operation,
    # not a BACK press, swipe, reinstall, force-stop or data reset.
    result = BASE.adb("shell", "monkey", "-p", BASE.PACKAGE, "-c",
                      "android.intent.category.LAUNCHER", "1", timeout=30)
    if "Events injected: 1" not in result:
        raise RuntimeError("foreground-restore-unconfirmed")
    assert_same_pid(before_pid)
    # Do not attempt any touch unless both readings prove the same safe target.
    if BASE.safe_environment_summary().get("foregroundCategory") != "negresco-app":
        raise RuntimeError("app-focus-unconfirmed")
    if BASE.lookup("Seu dinheiro.") is not None:
        raise RuntimeError("already-on-home-unconfirmed")
    if debug.safe_debug_testid_nav_geometry() != "testid-three-targets-bounded-readonly":
        raise RuntimeError("three-target-bounds-unconfirmed")
    width, height = BASE.screen_size()
    first = safe_home_target(BASE.xml_nodes(), width, height, BASE.PACKAGE)
    if first is None:
        raise RuntimeError("first-home-target-unconfirmed")
    time.sleep(.25)
    second = safe_home_target(BASE.xml_nodes(), width, height, BASE.PACKAGE)
    if second is None or second != first:
        raise RuntimeError("stable-home-target-unconfirmed")
    assert_same_pid(before_pid)
    # Exactly one geometrically checked Debug-only native tab tap.
    BASE.adb("shell", "input", "tap", str(second[0]), str(second[1]), timeout=10)
    for _ in range(6):
        assert_same_pid(before_pid)
        nodes = BASE.xml_nodes()
        homes = [n for n in nodes
                 if n.get("resource-id", "").rsplit("/", 1)[-1] == TAB_IDS[0]]
        banner = [n for n in nodes
                  if n.get("text") == "Seu dinheiro." and n.get("enabled") == "true"]
        if len(homes) == 1 and homes[0].get("selected") == "true" and len(banner) == 1:
            print("PASS (LAB): one bounded Debug Home return in same process",
                  flush=True)
            return
        time.sleep(.6)
    raise RuntimeError("home-only-state-unconfirmed")


def run() -> None:
    if len(sys.argv) != 1 or semantic.REPORT.exists():
        raise RuntimeError("unsafe-or-stale-nav-lab")
    original_run = semantic.run_lab
    original_probe = debug.observe_debug_home_geometry
    pid_before: str | None = None
    pdf_receipts = 0

    def home_probe() -> None:
        nonlocal pid_before
        original_probe()
        current = geometry.observed_single_app_pid()
        if not current or (pid_before is not None and current != pid_before):
            raise RuntimeError("initial-process-unconfirmed")
        pid_before = current

    def pdf_then_navigate() -> None:
        nonlocal pdf_receipts
        if not pid_before:
            raise RuntimeError("initial-process-unconfirmed")
        original_run()  # One real PDF A; independent receiver and semantic receipt.
        if not semantic.REPORT.is_file():
            raise RuntimeError("synthetic-pdf-a-receipt-missing")
        pdf_receipts += 1
        navigate_after_verified_pdf(pid_before)

    debug.observe_debug_home_geometry = home_probe
    semantic.run_lab = pdf_then_navigate
    try:
        debug.run()  # Preserves offline Metro, APK digest, permissions and cleanup.
        if pdf_receipts != 1:
            raise RuntimeError("unexpected-pdf-cycle-count")
    finally:
        semantic.run_lab = original_run
        debug.observe_debug_home_geometry = original_probe


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): same-PID Debug Home navigation not attested",
              file=sys.stderr)
        raise SystemExit(1)
