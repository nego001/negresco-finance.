#!/usr/bin/env python3
"""Synthetic-only Debug API28 root placement and UIAutomator evidence after verified PDF A.

This is a read-only navigation diagnostic. No tap, Back, swipe, user data,
original Release APK changes, or PDF B. Never print raw UI XML or geometry.
"""
from __future__ import annotations

import sys
import guardiao_pdf_debug_metro_lab as debug
import guardiao_android_export_pdf_text_emulator_smoke as semantic


def run() -> None:
    if len(sys.argv) != 1 or semantic.REPORT.exists():
        raise RuntimeError("unsafe-or-stale-passive-yoga-lab")
    original = semantic.run_lab
    verified = 0

    def observe_after_verified_pdf() -> None:
        nonlocal verified
        original()  # Full independent real PDF, semantics and cache receipt.
        if not semantic.REPORT.is_file():
            raise RuntimeError("verified-pdf-receipt-unconfirmed")
        verified += 1
        yoga = debug.safe_debug_testid_yoga_category()
        native = debug.safe_debug_testid_nav_geometry()
        placement = debug.safe_debug_bottom_placement_category()
        print("ENV (LAB): post-PDF native Yoga tag=" + yoga, flush=True)
        print("ENV (LAB): post-PDF UIAutomator bounds=" + native, flush=True)
        print("ENV (LAB): post-PDF root placement=" + placement, flush=True)
        # A THIN measurement is a valid diagnostic; never a nav approval.
        if yoga not in ("testid-yoga-all-regular", "testid-yoga-some-thin"):
            raise RuntimeError("native-yoga-marker-unconfirmed")
        if placement not in ("testid-bottom-inside-root","testid-bottom-overflows-root","testid-bottom-above-root"):
            raise RuntimeError("bottom-root-placement-unconfirmed")
        if native not in (
            "testid-three-targets-thin",
            "testid-three-targets-bounded-readonly",
            "testid-targets-mixed-or-unsafe",
        ):
            raise RuntimeError("native-target-classification-unconfirmed")
        print("PASS (LAB): diagnostic classifications observed; no navigation authorized", flush=True)

    semantic.run_lab = observe_after_verified_pdf
    try:
        debug.run()  # Original synthetic validation, private Metro, SHA and cleanup.
        if verified != 1:
            raise RuntimeError("verified-synthetic-pdf-count-unconfirmed")
    finally:
        semantic.run_lab = original


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): passive Yoga versus native proof incomplete", file=sys.stderr)
        raise SystemExit(1)
