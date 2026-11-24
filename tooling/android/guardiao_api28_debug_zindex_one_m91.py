#!/usr/bin/env python3
"""M91: exact M89 Debug control with root zIndex reduced from four to one."""
from __future__ import annotations
import os
from pathlib import Path
import sys
from guardiao_api28_debug_zindex_only_m89 import transform as m89_pure, ROOT_STYLE, OLD as ORIGINAL, NEW as OLD

LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-zindex-one-m91-v1"
NEW = "labAndroidRootHitOrder:{zIndex:1},"

def transform(source: str) -> str:
    if type(source) is not str or source.count(ORIGINAL) != 1 or OLD in source or NEW in source:
        raise RuntimeError("original root definition not uniquely attested")
    control = m89_pure(source)
    if control.count(OLD) != 1 or NEW in control or ORIGINAL in control:
        raise RuntimeError("M89 control definition not attested")
    changed = control.replace(OLD, NEW)
    if changed.count(NEW) != 1 or OLD in changed or changed.count(ROOT_STYLE) != 1:
        raise RuntimeError("unexpected root definition")
    if changed.replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated root style change")
    return changed

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M91 branch")
        path = Path("apps/mobile/App.tsx")
        if not path.is_file() or path.is_symlink():
            raise RuntimeError("unexpected app source")
        original = path.read_text(encoding="utf-8")
        changed = transform(original)
        if changed == original:
            raise RuntimeError("no scoped change")
        path.write_text(changed, encoding="utf-8")
        if path.read_text(encoding="utf-8") != changed:
            raise RuntimeError("cannot attest temporary style control")
        print("PASS (LAB): M91 exact M89 control with root zIndex one; no elevation", flush=True)
    except Exception:
        print("BLOCK (LAB): M91 scoped zIndex-one control not attested", file=sys.stderr)
        raise SystemExit(1)
