#!/usr/bin/env python3
"""Conditional read-only focus sample AFTER a null-root UIAutomator failure.

This is not an atomic reading of the foreground window at dump time.
Preserves the original CompletedProcess, return code, and hard BLOCK.
No XML, focus dump, package path, PID, exception text, or financial data logged.
"""
from __future__ import annotations

import subprocess
import sys
import guardiao_api28_dump_stream_shapes_lab as prior
import guardiao_original_release_same_process_lab as home
import guardiao_pdf_ui_emulator_smoke as base

PINNED_SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): null-root focus correlation incomplete"
FOCUS_CATEGORIES = frozenset((
    "window-focus-app", "window-focus-chooser", "window-focus-other",
    "window-focus-ime-named", "window-focus-null", "window-focus-unconfirmed"
))


def is_null_root(args: object, result: object) -> bool:
    """Match the observed zero/empty/null-root signature, not unrelated commands."""
    if not prior.is_target(args):
        return False
    code = getattr(result, "returncode", None)
    output = getattr(result, "stdout", None)
    error = getattr(result, "stderr", None)
    return (type(code) is int and code == 0 and type(output) is str
            and not output.strip() and type(error) is str
            and "null root node" in error.lower())


def focus_after_error() -> str:
    """One bounded read-only ADB request; never expose the raw result."""
    try:
        raw = base.adb("shell", "dumpsys", "window", "windows",
                       timeout=8, check=False)
        if type(raw) is str:
            category = home.safe_window_focus_category(raw, base.PACKAGE)
            if category in FOCUS_CATEGORIES:
                return category
    except Exception:
        pass
    return "window-focus-unconfirmed"


def run() -> None:
    if (len(sys.argv) != 1 or prior.PINNED_SHA != PINNED_SHA
            or prior.base is not base or home.base is not base):
        raise RuntimeError("pinned null-root laboratory not verified")

    original_run = subprocess.run

    def observe(args, *rest, **kwargs):
        result = original_run(args, *rest, **kwargs)
        if is_null_root(args, result):
            print("ENV (LAB): null-root-focus-after-dump=" +
                  focus_after_error(), flush=True)
        return result

    subprocess.run = observe
    try:
        prior.run()
    finally:
        subprocess.run = original_run


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)
