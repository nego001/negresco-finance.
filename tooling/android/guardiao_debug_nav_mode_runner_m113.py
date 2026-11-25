#!/usr/bin/env python3
"""M113: two fixed Android navigation modes, isolated API35 emulator only."""
from __future__ import annotations

import os
import re
import subprocess
import sys

LAB_REF = "refs/heads/lab/p01-guardiao-debug-nav-modes-m113-v1"
MODES = {"gestural": "2", "threebutton": "0"}
PREFIX = "com.android.internal.systemui.navbar."
STAGING = "tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py"

def adb(*args):
    p = subprocess.run(["adb", "-s", "emulator-5554", *args], capture_output=True,
                       text=True, timeout=25, check=True)
    if len(p.stdout) > 100000 or len(p.stderr) > 100000:
        raise RuntimeError("response limit")
    return p.stdout.strip()

def mode_proven(raw, mode):
    if type(raw) is not str or len(raw) > 100000 or mode not in MODES:
        return False
    matches = []
    for line in raw.splitlines():
        m = re.fullmatch(r"\[([x ])\]\s+(com\.android\.internal\.systemui\.navbar\.[a-zA-Z0-9_]+)", line.strip())
        if m:
            matches.append((m[1], m[2]))
    selected = PREFIX + mode
    return (len([p for _, p in matches]) == len(set(p for _, p in matches))
            and [(state, name) for state, name in matches if name == selected] == [("x", selected)]
            and [name for state, name in matches if state == "x"] == [selected])

def scope():
    return (os.environ.get("GITHUB_ACTIONS") == "true"
            and os.environ.get("GITHUB_REF") == LAB_REF
            and os.environ.get("M93_EXPECTED_API") == "35"
            and os.environ.get("M113_NAV_MODE") in MODES)

def verify(mode):
    if not mode_proven(adb("shell", "cmd", "overlay", "list", "--user", "0", "android"), mode):
        raise RuntimeError("overlay unconfirmed")
    if adb("shell", "settings", "--user", "0", "get", "secure", "navigation_mode") != MODES[mode]:
        raise RuntimeError("SystemUI mode unconfirmed")

def run():
    if not scope():
        raise RuntimeError("scope unconfirmed")
    mode = os.environ["M113_NAV_MODE"]
    if adb("shell", "getprop", "ro.kernel.qemu") != "1" or adb("shell", "getprop", "ro.build.version.sdk") != "35":
        raise RuntimeError("emulator unconfirmed")
    if adb("shell", "am", "get-current-user") != "0":
        raise RuntimeError("user unconfirmed")
    # AOSP documented overlay mechanism, only on the disposable runner.
    adb("shell", "cmd", "overlay", "enable-exclusive", "--category", "--user", "0", PREFIX + mode)
    # Fixed settle for SystemUI resource propagation, before launching app.
    import time
    time.sleep(5)
    verify(mode)
    print("PASS (LAB): M113 exact system navigation mode before launch=" + mode, flush=True)
    subprocess.run([sys.executable, STAGING], check=True, timeout=900)
    verify(mode)
    print("PASS (LAB): M113 exact system navigation mode after native geometry=" + mode, flush=True)

if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("unexpected arguments")
        run()
    except Exception:
        print("BLOCK (LAB): M113 navigation mode matrix not attested", file=sys.stderr)
        raise SystemExit(1)
