#!/usr/bin/env python3
"""LAB ONLY: characterize Android 9 accessibility window inventory after null-root.

The active-window root is read by the original UIAutomator command, not here.
This collects only a fixed category from one bounded dumpsys accessibility
AFTER the first null-root. It cannot authorize navigation or retry XML.
Never log raw output, packages, window IDs, text, paths, XML or exceptions.
"""
from __future__ import annotations

import re
import sys

import guardiao_api28_null_root_focus_correlation_lab as root
import guardiao_pdf_ui_emulator_smoke as base

PINNED_SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): accessibility window inventory diagnosis incomplete"
WINDOWS_UNCONFIRMED = "accessibility-windows-unconfirmed"


def category(raw: object) -> str:
    """Match only the AOSP Pie dump header and bounded Window[...] record count."""
    if type(raw) is not str or not (0 < len(raw) <= 512_000):
        return WINDOWS_UNCONFIRMED
    if "ACCESSIBILITY MANAGER (dumpsys accessibility)" not in raw[:8192]:
        return WINDOWS_UNCONFIRMED
    matches = re.findall(r"(?m)^\s*Window\[", raw)
    if len(matches) > 32:
        return WINDOWS_UNCONFIRMED
    return ("accessibility-windows-listed" if matches
            else "accessibility-windows-not-listed")


def sample() -> str:
    try:
        raw = base.adb("shell", "dumpsys", "accessibility",
                       timeout=8, check=False)
        return category(raw)
    except Exception:
        return WINDOWS_UNCONFIRMED


def run() -> None:
    if (len(sys.argv) != 1 or root.PINNED_SHA != PINNED_SHA
            or root.base is not base):
        raise RuntimeError("pinned API28 lab mismatch")
    original_focus = root.focus_after_error
    sampled = False

    def observe_focus_after_null_root() -> str:
        nonlocal sampled
        # Original focus observation remains unchanged; it cannot authorize a
        # UI action. Accessibility inquiry happens only on the null-root path.
        focus = original_focus()
        if not sampled:
            sampled = True
            print("ENV (LAB): post-null-root-a11y-windows=" + sample(), flush=True)
        return focus

    root.focus_after_error = observe_focus_after_null_root
    try:
        root.run()
    finally:
        root.focus_after_error = original_focus


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)
