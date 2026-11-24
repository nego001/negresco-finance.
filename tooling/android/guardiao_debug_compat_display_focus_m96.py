#!/usr/bin/env python3
"""M96: replace incompatible focus query with strict default-display proof."""
from __future__ import annotations
import os
import sys
from guardiao_debug_compat_focus_m95 import APP, OBSERVER, APIS, m91_pure, focus_transform, NEW as OLD

LAB_REF = "refs/heads/lab/p01-guardiao-debug-compat-display-focus-m96-v1"
NEW = "def classify_display_focus(raw: object) -> str:\n    \"\"\"Only one default display and one exact app window focus; never expose raw.\"\"\"\n    if type(raw) is not str or not raw or len(raw) > 2000000:\n        return \"response-unconfirmed\"\n    lines = [line.strip() for line in raw.splitlines()]\n    headers = [i for i,line in enumerate(lines) if line.startswith(\"Display: mDisplayId=\")]\n    markers = [i for i,line in enumerate(lines) if line.startswith(\"mCurrentFocus=\")]\n    if lines.count(\"WINDOW MANAGER DISPLAY CONTENTS (dumpsys window displays)\") != 1:\n        return \"display-header-unconfirmed\"\n    if len(headers) != 1 or not re.fullmatch(r\"Display: mDisplayId=0(?: rootTasks=[0-9]+)?\", lines[headers[0]]):\n        return \"default-display-unconfirmed\"\n    if len(markers) != 1 or markers[0] <= headers[0]:\n        return \"focus-marker-unconfirmed\"\n    marker = lines[markers[0]]\n    if len(marker) > 1024:\n        return \"focus-marker-unconfirmed\"\n    if marker == \"mCurrentFocus=null\":\n        return \"null-focus\"\n    if not re.fullmatch(r\"mCurrentFocus=Window\\{[0-9a-fA-F]+ u0 com\\.negresco\\.finance/[A-Za-z0-9_.$]+\\}\", marker):\n        return \"focus-not-attested\"\n    return \"default-display-app-focus\"\n\ndef debug_focus() -> bool:\n    try:\n        raw = BASE.adb(\"shell\", \"dumpsys\", \"window\", \"displays\", timeout=22)\n    except subprocess.TimeoutExpired:\n        print(\"ENV (LAB): m96-focus=command-timeout\", flush=True)\n        raise\n    except Exception:\n        print(\"ENV (LAB): m96-focus=command-error\", flush=True)\n        raise\n    category = classify_display_focus(raw)\n    print(\"ENV (LAB): m96-focus=\" + category, flush=True)\n    return category == \"default-display-app-focus\"\n"

def display_transform(source: str, api: str) -> str:
    control = focus_transform(source, api)
    if control.count(OLD) != 1 or NEW in control:
        raise RuntimeError("M95 focus source not uniquely attested")
    changed = control.replace(OLD, NEW)
    if changed.count(NEW) != 1 or changed.replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated display focus change")
    return changed

def apply(api: str) -> None:
    if any(not p.is_file() or p.is_symlink() for p in (APP, OBSERVER)):
        raise RuntimeError("unexpected source path")
    app = m91_pure(APP.read_text(encoding="utf-8"))
    observer = display_transform(OBSERVER.read_text(encoding="utf-8"), api)
    APP.write_text(app, encoding="utf-8")
    OBSERVER.write_text(observer, encoding="utf-8")
    if APP.read_text(encoding="utf-8") != app or OBSERVER.read_text(encoding="utf-8") != observer:
        raise RuntimeError("temporary source not attested")

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M96 branch")
        api = os.environ.get("M93_EXPECTED_API")
        if api not in APIS:
            raise RuntimeError("M96 matrix API not allowlisted")
        apply(api)
        print("PASS (LAB): M96 strict display focus control API " + api, flush=True)
    except Exception:
        print("BLOCK (LAB): M96 scoped display focus source not attested", file=sys.stderr)
        raise SystemExit(1)
