#!/usr/bin/env python3
"""M98: exact API35-only organized display header variant, no focus bypass."""
from __future__ import annotations
import os
import sys
from guardiao_debug_api35_display_shape_m97 import APP, OBSERVER, m91_pure, shape_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-organized-display-m98-v1"
OLD = "    if len(headers) != 1 or not re.fullmatch(r\"Display: mDisplayId=0(?: rootTasks=[0-9]+)?\", lines[headers[0]]):"
NEW = "    organized = len(headers) == 1 and lines[headers[0]] == \"Display: mDisplayId=0 (organized)\"\n    if organized:\n        print(\"ENV (LAB): m98-display-shape=organized-default\", flush=True)\n    if len(headers) != 1 or not (organized or re.fullmatch(r\"Display: mDisplayId=0(?: rootTasks=[0-9]+)?\", lines[headers[0]])):"

def organized_transform(source: str, api: str) -> str:
    if type(api) is not str or api != "35":
        raise RuntimeError("M98 exact API35 required")
    control = shape_transform(source, api)
    if control.count(OLD) != 1 or NEW in control:
        raise RuntimeError("M97 display guard not uniquely attested")
    changed = control.replace(OLD, NEW)
    if changed.count(NEW) != 1 or changed.replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated organized header change")
    return changed

def apply(api: str) -> None:
    if any(not p.is_file() or p.is_symlink() for p in (APP, OBSERVER)):
        raise RuntimeError("unexpected source path")
    app = m91_pure(APP.read_text(encoding="utf-8"))
    observer = organized_transform(OBSERVER.read_text(encoding="utf-8"), api)
    APP.write_text(app, encoding="utf-8")
    OBSERVER.write_text(observer, encoding="utf-8")
    if APP.read_text(encoding="utf-8") != app or OBSERVER.read_text(encoding="utf-8") != observer:
        raise RuntimeError("temporary source not attested")

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M98 branch")
        api = os.environ.get("M93_EXPECTED_API")
        if api != "35":
            raise RuntimeError("M98 exact API35 required")
        apply(api)
        print("PASS (LAB): M98 exact M97 control plus literal organized default display", flush=True)
    except Exception:
        print("BLOCK (LAB): M98 scoped organized display source not attested", file=sys.stderr)
        raise SystemExit(1)
