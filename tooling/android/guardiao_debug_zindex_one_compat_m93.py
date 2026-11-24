#!/usr/bin/env python3
"""M93: exact M91 app transform and one disposable observer SDK gate."""
from __future__ import annotations
import os
from pathlib import Path
import sys
from guardiao_api28_debug_zindex_one_m91 import transform as m91_pure

LAB_REF = "refs/heads/lab/p01-guardiao-debug-zindex-one-compat-m93-v1"
APIS = ("29", "35")
OBSERVER = Path("tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py")
APP = Path("apps/mobile/App.tsx")
OLD = 'if BASE.adb("shell", "getprop", "ro.build.version.sdk").strip() != "28":\n        raise RuntimeError("Android9 API28 not confirmed")'

def observer_transform(source: str, api: str) -> str:
    if type(api) is not str or api not in APIS:
        raise RuntimeError("M93 API not allowlisted")
    if type(source) is not str or source.count(OLD) != 1:
        raise RuntimeError("original exact SDK guard not attested")
    new = ('if BASE.adb("shell", "getprop", "ro.build.version.sdk").strip() != "' + api
           + '":\n        raise RuntimeError("M93 exact Android SDK not confirmed")')
    if new in source:
        raise RuntimeError("SDK guard already modified")
    changed = source.replace(OLD, new)
    if changed.count(new) != 1 or changed.replace(new, OLD) != source:
        raise RuntimeError("nonisolated SDK guard delta")
    return changed

def apply(api: str) -> None:
    if any(not p.is_file() or p.is_symlink() for p in (APP, OBSERVER)):
        raise RuntimeError("unexpected source path")
    original_app = APP.read_text(encoding="utf-8")
    original_observer = OBSERVER.read_text(encoding="utf-8")
    app = m91_pure(original_app)
    observer = observer_transform(original_observer, api)
    if app == original_app or observer == original_observer:
        raise RuntimeError("missing exact source change")
    APP.write_text(app, encoding="utf-8")
    OBSERVER.write_text(observer, encoding="utf-8")
    if APP.read_text(encoding="utf-8") != app or OBSERVER.read_text(encoding="utf-8") != observer:
        raise RuntimeError("temporary source not attested")

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M93 branch")
        api = os.environ.get("M93_EXPECTED_API")
        if api not in APIS:
            raise RuntimeError("M93 matrix API not allowlisted")
        apply(api)
        print("PASS (LAB): M93 exact M91 app and exact observer SDK " + api, flush=True)
    except Exception:
        print("BLOCK (LAB): M93 scoped compatibility source not attested", file=sys.stderr)
        raise SystemExit(1)
