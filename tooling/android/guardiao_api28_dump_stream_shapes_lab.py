#!/usr/bin/env python3
"""Read-only diagnostics for shape of uiAutomator dump stdout/stderr.

Observe the single subprocess already executed by the strict unique-capture
runner. Never emit raw command output, path, XML, asset, package, or exception.
Do not alter return codes, outputs, retry decisions or app actions.
"""
from __future__ import annotations

import subprocess
import sys
import guardiao_api28_unique_xml_capture_gate_lab as prior
import guardiao_pdf_ui_emulator_smoke as base

PINNED_SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): dump stream shape diagnostic incomplete"


def stream_shape(value: object, path: str) -> str:
    """Finite metadata only. No text or path is returned to the caller."""
    if type(value) is not str:
        return "nontext"
    value = value.strip()
    if not value:
        return "empty"
    lower = value.lower()
    if "could not get idle state" in lower:
        return "idle-unavailable"
    if "null root node" in lower:
        return "null-root"
    if "permission denied" in lower:
        return "permission-denied"
    if value.startswith("UI hier") and value.endswith("dumped to: " + path):
        return "exact-ack"
    if "dumped to:" in lower and path in value:
        return "ack-with-extra-text"
    if "dumped to:" in lower:
        return "ack-other-or-no-destination"
    if "error:" in lower or "exception" in lower:
        return "other-error"
    if path in value:
        return "mentions-destination-without-ack"
    return "other-text"


def is_target(args: object) -> bool:
    return (type(args) in (list, tuple) and len(args) == 5
            and tuple(args[:4]) == ("adb", "shell", "uiautomator", "dump")
            and type(args[4]) is str
            and args[4].startswith("/data/local/tmp/ng_ui_")
            and args[4].endswith(".xml"))


def run() -> None:
    if len(sys.argv) != 1 or prior.SHA != PINNED_SHA or base is not prior.base:
        raise RuntimeError("pinned lab instrumentation mismatch")
    original_subprocess_run = subprocess.run
    count = 0

    def observe(args, *rest, **kwargs):
        nonlocal count
        if not is_target(args):
            return original_subprocess_run(args, *rest, **kwargs)
        count += 1
        try:
            completed = original_subprocess_run(args, *rest, **kwargs)
        except subprocess.TimeoutExpired:
            print("ENV (LAB): dump-exit=timeout stdout=not-available stderr=not-available",
                  flush=True)
            raise
        except Exception:
            print("ENV (LAB): dump-exit=exception stdout=not-available stderr=not-available",
                  flush=True)
            raise
        code = getattr(completed, "returncode", None)
        exit_label = "zero" if type(code) is int and code == 0 else (
            "nonzero" if type(code) is int else "unconfirmed")
        stdout_shape = stream_shape(getattr(completed, "stdout", None), args[4])
        stderr_shape = stream_shape(getattr(completed, "stderr", None), args[4])
        print("ENV (LAB): dump-exit=" + exit_label +
              " stdout=" + stdout_shape + " stderr=" + stderr_shape, flush=True)
        return completed

    subprocess.run = observe
    try:
        prior.run()
    finally:
        subprocess.run = original_subprocess_run


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)
