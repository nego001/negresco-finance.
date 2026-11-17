#!/usr/bin/env python3
"""One conditional read-only focus sample after existing resolver UI snapshot.

A framework resolver marker already means the strict Home gate will fail.
Only on that marker, sample Android's window focus once, immediately after
classifying the existing snapshot. This read is NOT atomic with the snapshot.
Never publish window dumps, activity names, private data, exceptions, or UI.
"""
from __future__ import annotations

import sys
import guardiao_v5_api28_framework_resource_signals_lab as resource
import guardiao_original_release_same_process_lab as home

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): Android9 resolver focus observation unverified"
WINDOW = frozenset((
    "window-focus-unconfirmed", "window-focus-null", "window-focus-app",
    "window-focus-ime-named", "window-focus-chooser", "window-focus-other",
))


def resolver_trigger(nodes: object, width: object, height: object) -> str:
    """Uses existing allowlisted framework resource classifier, no Android reads."""
    signals = resource.classify(nodes, width, height)
    if any(v == "unconfirmed" for v in signals):
        return "unconfirmed"
    if signals[0] == "present" or signals[1] == "present":
        return "resolver-marker-present"
    return "resolver-marker-absent"


def observe(nodes: object, width: object, height: object) -> tuple[str, str]:
    """Return fixed categories only; one bounded ADB read on observed marker.

    ADB read may finish after a window transition: never attribute its result
    to the exact moment of the UI snapshot or use it to approve navigation.
    """
    marker = resolver_trigger(nodes, width, height)
    if marker != "resolver-marker-present":
        return marker, "focus-not-sampled"
    focus = "window-focus-unconfirmed"
    try:
        private = home.base.adb("shell", "dumpsys", "window", "windows",
                                timeout=8, check=False)
        if type(private) is str:
            focus = home.safe_window_focus_category(private, home.base.PACKAGE)
    except Exception:
        pass
    if focus not in WINDOW:
        focus = "window-focus-unconfirmed"
    return marker, focus


def run() -> None:
    if len(sys.argv) != 1 or resource.SHA != SHA:
        raise RuntimeError("pinned candidate identity rejected")
    original = resource.classify

    def inspect_existing_snapshot(nodes, width, height):
        marker, focus = observe(nodes, width, height)
        print("ENV (LAB): resolver-snapshot=" + marker +
              " focus-after-snapshot=" + focus, flush=True)
        return original(nodes, width, height)

    resource.classify = inspect_existing_snapshot
    try:
        resource.run()
    finally:
        resource.classify = original


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)
