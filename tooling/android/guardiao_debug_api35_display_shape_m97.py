#!/usr/bin/env python3
"""M97: diagnose the existing API35 display-shape failure without changing its gate."""
from __future__ import annotations
import os
import sys
from guardiao_debug_compat_display_focus_m96 import APP, OBSERVER, m91_pure, display_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-display-shape-m97-v1"
OLD = "    if len(headers) != 1 or not re.fullmatch(r\"Display: mDisplayId=0(?: rootTasks=[0-9]+)?\", lines[headers[0]]):\n        return \"default-display-unconfirmed\""
NEW = "    if len(headers) != 1 or not re.fullmatch(r\"Display: mDisplayId=0(?: rootTasks=[0-9]+)?\", lines[headers[0]]):\n        # The existing failure decision remains authoritative. Inspect only\n        # the same private response; emit no display IDs or raw text.\n        default_headers = [i for i in headers if re.match(r\"Display: mDisplayId=0(?:\\s|$)\", lines[i])]\n        if not headers:\n            category = \"no-display-header\"\n        elif not default_headers:\n            category = \"default-header-missing\"\n        elif len(default_headers) != 1:\n            category = \"duplicate-default-header\"\n        elif len(headers) != 1:\n            category = \"multiple-display-headers\"\n        else:\n            category = \"default-header-format-unconfirmed\"\n        print(\"ENV (LAB): m97-display-shape=\" + category, flush=True)\n        return \"default-display-unconfirmed\""

def shape_transform(source: str, api: str) -> str:
    if type(api) is not str or api != "35":
        raise RuntimeError("M97 exact API35 required")
    control = display_transform(source, api)
    if control.count(OLD) != 1 or NEW in control:
        raise RuntimeError("M96 display guard not uniquely attested")
    changed = control.replace(OLD, NEW)
    if changed.count(NEW) != 1 or changed.replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated display shape diagnostic")
    return changed

def apply(api: str) -> None:
    if any(not p.is_file() or p.is_symlink() for p in (APP, OBSERVER)):
        raise RuntimeError("unexpected source path")
    app = m91_pure(APP.read_text(encoding="utf-8"))
    observer = shape_transform(OBSERVER.read_text(encoding="utf-8"), api)
    APP.write_text(app, encoding="utf-8")
    OBSERVER.write_text(observer, encoding="utf-8")
    if APP.read_text(encoding="utf-8") != app or OBSERVER.read_text(encoding="utf-8") != observer:
        raise RuntimeError("temporary source not attested")

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M97 branch")
        api = os.environ.get("M93_EXPECTED_API")
        if api != "35":
            raise RuntimeError("M97 exact API35 required")
        apply(api)
        print("PASS (LAB): M97 exact M96 control plus fixed API35 display shape categories", flush=True)
    except Exception:
        print("BLOCK (LAB): M97 scoped display shape source not attested", file=sys.stderr)
        raise SystemExit(1)
