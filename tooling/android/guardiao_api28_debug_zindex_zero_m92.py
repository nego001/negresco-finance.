#!/usr/bin/env python3
"""M92: exact M91 Debug control with explicit root zIndex zero."""
from __future__ import annotations
import os
from pathlib import Path
import sys
from guardiao_api28_debug_zindex_one_m91 import transform as m91_pure, ROOT_STYLE, ORIGINAL, NEW as OLD

LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-zindex-zero-m92-v1"
NEW = "labAndroidRootHitOrder:{zIndex:0},"

def transform(source: str) -> str:
    if type(source) is not str or source.count(ORIGINAL) != 1 or OLD in source or NEW in source:
        raise RuntimeError("original root definition not uniquely attested")
    control = m91_pure(source)
    if control.count(OLD) != 1 or NEW in control or ORIGINAL in control:
        raise RuntimeError("M91 control definition not attested")
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
            raise RuntimeError("unrecognized M92 branch")
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
        print("PASS (LAB): M92 exact M91 control with explicit root zIndex zero; no elevation", flush=True)
    except Exception:
        print("BLOCK (LAB): M92 scoped zIndex-zero control not attested", file=sys.stderr)
        raise SystemExit(1)
