#!/usr/bin/env python3
"""M95: same M94 control and original focus predicate, fixed private categories."""
from __future__ import annotations
import os
import sys
from guardiao_debug_compat_preflight_m94 import APP, OBSERVER, APIS, m91_pure, diagnostic_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-compat-focus-m95-v1"
OLD = "def debug_focus() -> bool:\n    \"\"\"Read only a fixed package-equality predicate; discard entire raw window dump.\"\"\"\n    raw = BASE.adb(\"shell\", \"dumpsys\", \"window\", \"windows\", timeout=22)\n    for line in raw.splitlines():\n        if \"mCurrentFocus=\" in line and len(line) <= 1024:\n            return re.search(r\"\\bu0 com\\.negresco\\.finance/\", line) is not None\n    return False\n"
NEW = "def debug_focus() -> bool:\n    \"\"\"Same original predicate; emit fixed categories from the same read only.\"\"\"\n    try:\n        raw = BASE.adb(\"shell\", \"dumpsys\", \"window\", \"windows\", timeout=22)\n    except subprocess.TimeoutExpired:\n        print(\"ENV (LAB): m95-focus=command-timeout\", flush=True)\n        raise\n    except Exception:\n        print(\"ENV (LAB): m95-focus=command-error\", flush=True)\n        raise\n    if not raw:\n        print(\"ENV (LAB): m95-focus=empty-response\", flush=True)\n    oversized_marker = False\n    for line in raw.splitlines():\n        if \"mCurrentFocus=\" in line and len(line) <= 1024:\n            matched = re.search(r\"\\bu0 com\\.negresco\\.finance/\", line) is not None\n            if matched:\n                category = \"original-match\"\n            elif line.partition(\"mCurrentFocus=\")[2].strip() in (\"null\", \"None\"):\n                category = \"null-marker\"\n            elif \"com.negresco.finance\" in line:\n                category = \"app-token-nonmatching\"\n            else:\n                category = \"nonmatching-marker\"\n            print(\"ENV (LAB): m95-focus=\" + category, flush=True)\n            return matched\n        if \"mCurrentFocus=\" in line:\n            oversized_marker = True\n    if raw:\n        print(\"ENV (LAB): m95-focus=\" + (\"oversized-marker\" if oversized_marker else \"missing-marker\"), flush=True)\n    return False\n"

def focus_transform(source: str, api: str) -> str:
    control = diagnostic_transform(source, api)
    if control.count(OLD) != 1 or NEW in control:
        raise RuntimeError("original focus predicate not uniquely attested")
    changed = control.replace(OLD, NEW)
    if changed.count(NEW) != 1 or changed.replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated focus diagnostic")
    return changed

def apply(api: str) -> None:
    if any(not p.is_file() or p.is_symlink() for p in (APP, OBSERVER)):
        raise RuntimeError("unexpected source path")
    app = m91_pure(APP.read_text(encoding="utf-8"))
    observer = focus_transform(OBSERVER.read_text(encoding="utf-8"), api)
    APP.write_text(app, encoding="utf-8")
    OBSERVER.write_text(observer, encoding="utf-8")
    if APP.read_text(encoding="utf-8") != app or OBSERVER.read_text(encoding="utf-8") != observer:
        raise RuntimeError("temporary source not attested")

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M95 branch")
        api = os.environ.get("M93_EXPECTED_API")
        if api not in APIS:
            raise RuntimeError("M95 matrix API not allowlisted")
        apply(api)
        print("PASS (LAB): M95 exact M94 control plus focus categories API " + api, flush=True)
    except Exception:
        print("BLOCK (LAB): M95 scoped focus diagnostic not attested", file=sys.stderr)
        raise SystemExit(1)
