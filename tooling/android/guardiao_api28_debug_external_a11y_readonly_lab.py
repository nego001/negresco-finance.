#!/usr/bin/env python3
"""Ephemeral API28 Debug-only, no-permission external root observer.

Fresh emulator, fresh Debug APK, no payment/PDF/UI gestures, only bounded
presence/foreign/null categories. Never print app data, package names from
the observed window, Android dumps, XML, PID, screenshots or exceptions.
"""
from __future__ import annotations

import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
from collections.abc import Callable

import guardiao_pdf_debug_metro_lab as debug

BASE = debug.base
DEBUG_PACKAGE = "com.negresco.finance"
OBSERVER_PACKAGE = "com.negresco.a11ydebugobserver.lab"
OBSERVER_APK = Path(
    "tooling/android/a11y-debug-observer-lab/app/build/outputs/apk/debug/a11y-debug-observer-lab.apk"
)
LIMIT = 64000
BLOCK = "BLOCK (LAB): isolated Debug-only active root observation incomplete"
MODE = "idle"


def parse_instrumentation(raw: object) -> tuple[str, str, str]:
    """Strictly map the private response into three fixed categorical values."""
    if type(raw) is not str or not 1 <= len(raw) <= LIMIT:
        return "unconfirmed", "unconfirmed", "---"
    fields: dict[str, str] = {}
    codes: list[str] = []
    required = {"sample1", "sample2", "sample3", "mode", "idle", "verdict"}
    for line in raw.splitlines():
        if line.startswith("INSTRUMENTATION_RESULT: "):
            key, sep, value = line[len("INSTRUMENTATION_RESULT: "):].partition("=")
            if not sep or key not in required or key in fields:
                return "unconfirmed", "unconfirmed", "---"
            fields[key] = value.strip()
        elif line.startswith("INSTRUMENTATION_CODE: "):
            codes.append(line[len("INSTRUMENTATION_CODE: "):].strip())
        elif line.startswith(("INSTRUMENTATION_FAILED:", "INSTRUMENTATION_ABORTED:")):
            return "unconfirmed", "unconfirmed", "---"
    if set(fields) != required or codes != ["-1"] or fields["mode"] != MODE:
        return "unconfirmed", "unconfirmed", "---"
    if fields["idle"] not in ("idle-observed", "idle-timeout"):
        return "unconfirmed", "unconfirmed", "---"
    samples = [fields[f"sample{i}"] for i in (1, 2, 3)]
    if any(s not in ("present", "null", "foreign") for s in samples):
        return fields["idle"], "unconfirmed", "---"
    pattern = "".join({"present": "P", "null": "N", "foreign": "F"}[s] for s in samples)
    if fields["verdict"] == "all-present" and pattern == "PPP" and fields["idle"] == "idle-observed":
        return "idle-observed", "all-present", pattern
    if fields["verdict"] == "some-unconfirmed" and pattern != "PPP" and fields["idle"] == "idle-observed":
        return "idle-observed", "some-unconfirmed", pattern
    return fields["idle"], "unconfirmed", "---"


def installed(package: str) -> bool:
    """Exact package result from a fresh emulator, never print query output."""
    raw = BASE.adb("shell", "pm", "list", "packages", package, timeout=20)
    return any(line.strip() == "package:" + package for line in raw.splitlines())


def debug_pid() -> str:
    raw = BASE.adb("shell", "pidof", DEBUG_PACKAGE, timeout=15).strip()
    if not re.fullmatch(r"[1-9][0-9]{0,8}", raw):
        raise RuntimeError("debug process PID unconfirmed")
    return raw


def debug_focus() -> bool:
    """Read only a fixed package-equality predicate; discard entire raw window dump."""
    raw = BASE.adb("shell", "dumpsys", "window", "windows", timeout=22)
    for line in raw.splitlines():
        if "mCurrentFocus=" in line and len(line) <= 1024:
            return re.search(r"\bu0 com\.negresco\.finance/", line) is not None
    return False


def run(*, after_verified_observation: Callable[[], None] | None = None) -> None:
    if len(sys.argv) != 1 or MODE != "idle":
        raise RuntimeError("unexpected CLI args")
    if BASE.adb("shell", "getprop", "ro.build.version.sdk").strip() != "28":
        raise RuntimeError("Android9 API28 not confirmed")
    if installed(DEBUG_PACKAGE) or installed(OBSERVER_PACKAGE):
        raise RuntimeError("fresh emulator expected: known package already installed")
    if debug.semantic.REPORT.exists() or BASE.REPORT.exists():
        raise RuntimeError("previous PDF receipt exists")
    if debug.debug_digest() == "":
        raise RuntimeError("Debug APK SHA check unavailable")
    if not OBSERVER_APK.is_file() or OBSERVER_APK.is_symlink():
        raise RuntimeError("observer APK missing or symlinked")
    server = None
    relay = None
    try:
        server = debug.start_local_metro()
        debug.prewarm_android_bundle()
        relay = debug.transport.PrivateMetroRelay()
        relay.start()
        BASE.adb("reverse", f"tcp:{debug.BUNDLE_PORT}", f"tcp:{debug.transport.LISTEN_PORT}")
        relay.reset_after_preflight()
        BASE.adb("install", "-r", str(debug.APK), timeout=150)
        BASE.adb("install", "-t", "-r", str(OBSERVER_APK), timeout=60)
        launched = BASE.adb("shell", "monkey", "-p", DEBUG_PACKAGE,
                            "-c", "android.intent.category.LAUNCHER", "1", timeout=30)
        if "Events injected: 1" not in launched:
            raise RuntimeError("Debug app launch unconfirmed")
        # A single predeclared settling interval, not a retry after failed root.
        time.sleep(5.0)
        before_pid = debug_pid()
        if not debug_focus():
            raise RuntimeError("Debug foreground package unconfirmed")
        print("ENV (LAB): debug-observer-preflight=debug-focused", flush=True)
        raw = BASE.adb("shell", "am", "instrument", "-w", "-r",
                       "-e", "mode", MODE,
                       OBSERVER_PACKAGE + "/.ObserveInstrumentation", timeout=90)
        idle, verdict, mask = parse_instrumentation(raw)
        print("ENV (LAB): debug-external-idle=" + idle, flush=True)
        print("ENV (LAB): debug-external-root=" + verdict, flush=True)
        if mask != "---":
            print("ENV (LAB): debug-external-pattern=" + mask, flush=True)
        # Process and focus stability are independent post-observation gates.
        after_pid = debug_pid()
        if after_pid != before_pid or not debug_focus():
            raise RuntimeError("Debug focus or PID changed during observation")
        if (idle, verdict, mask) != ("idle-observed", "all-present", "PPP"):
            raise RuntimeError("Debug roots unconfirmed")
        # Optional independent, passive Home geometry proof, only AFTER a
        # verified PPP. Never lets the old observer bypass a geometry BLOCK.
        if after_verified_observation is not None:
            after_verified_observation()
            if debug_pid() != before_pid or not debug_focus():
                raise RuntimeError("Debug PID/focus changed during passive geometry read")
        print("PASS (LAB): Debug active-window package-only roots PPP without gestures/PDF")
    finally:
        # No durable APK, XML, logcat, PDF or artifacts. Never log cleanup error text.
        for pkg in (OBSERVER_PACKAGE, DEBUG_PACKAGE):
            try:
                BASE.adb("uninstall", pkg, timeout=35, check=False)
            except Exception:
                pass
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
        print(BLOCK, file=sys.stderr)
        raise SystemExit(1)
